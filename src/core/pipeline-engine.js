/**
 * pipeline-engine.js — 流水线执行引擎
 *
 * 核心逻辑：读取 workflow.yaml → 根据当前 spec 状态判断阶段 →
 * 检查前置产物 → 执行阶段（或等待人工干预） → 校验产物 → 推进下一阶段
 *
 * 引擎本身不执行 AI 任务；它是一个状态机控制器，负责：
 *   1. 状态判断和推进
 *   2. 产物校验门禁
 *   3. 阻断和上报
 *   4. 提供给 MCP Server 调用的 API
 */

import { join, resolve } from 'node:path';
import yaml from 'js-yaml';
import { NodeFileSystem } from './fs-interface.js';
import { PipelineStateStore } from './state-store.js';
import { SpecLock } from './lock.js';
import { ComplianceTracker } from './compliance-tracker.js';
import {
  checkPreconditions, checkStageOutputs,
  isReportPassing,
  inferStageFromArtifacts
} from './artifact-checker.js';

// ── Workflow 解析 ──────────────────────────────────────────────────────────

/**
 * 解析 workflow.yaml：使用 js-yaml（YAML 1.2 标准）解析，
 * 规范化 pipelines 结构使每个 pipeline 为步骤数组。
 */
function normalizePipelines(parsed) {
  if (!parsed.pipelines || typeof parsed.pipelines !== 'object') return;
  for (const [name, value] of Object.entries(parsed.pipelines)) {
    if (Array.isArray(value)) continue; // 已是步骤数组
    if (value && typeof value === 'object' && Array.isArray(value.steps)) {
      parsed.pipelines[name] = value.steps;
    } else {
      parsed.pipelines[name] = [];
    }
  }
}

export function loadWorkflow(projectRoot, fs = new NodeFileSystem()) {
  const wfPath = join(projectRoot, '.loom', 'workflow.yaml');
  if (!fs.existsSync(wfPath)) return null;

  let parsed;
  try {
    parsed = yaml.load(fs.readFileSync(wfPath, 'utf-8'), { schema: yaml.DEFAULT_SAFE_SCHEMA });
  } catch (err) {
    const detail = err.mark ? ` (line ${err.mark.line + 1})` : '';
    throw new Error(`YAML syntax error in ${wfPath}${detail}: ${err.reason || err.message}`);
  }

  if (!parsed || typeof parsed !== 'object' || !parsed.pipelines) {
    throw new Error(
      `Failed to parse any pipelines from ${wfPath}. ` +
      `Check indentation (2-space) and structure (pipelines: <name>: steps: - id: ...).`
    );
  }

  normalizePipelines(parsed);

  if (Object.keys(parsed.pipelines).length === 0) {
    throw new Error(
      `Failed to parse any pipelines from ${wfPath}. ` +
      `Check indentation (2-space) and structure (pipelines: <name>: steps: - id: ...).`
    );
  }

  // 结构校验：每个 pipeline 是数组，每个 step 有 id
  for (const [name, steps] of Object.entries(parsed.pipelines)) {
    if (!Array.isArray(steps)) {
      throw new Error(`Pipeline "${name}" must be a list of steps in ${wfPath}`);
    }
    for (const step of steps) {
      if (!step || !step.id) {
        throw new Error(`Pipeline "${name}" has a step missing "id" in ${wfPath}`);
      }
    }
  }

  return parsed;
}

// ── PipelineEngine ─────────────────────────────────────────────────────────

export class PipelineEngine {
  /**
   * @param {string} projectRoot  项目根目录
   * @param {string} specDir      specs/<date+feature> 的绝对路径
   */
  constructor(projectRoot, specDir, { fs } = {}) {
    this.projectRoot = resolve(projectRoot);
    this.specDir = resolve(specDir);
    this.fs = fs || new NodeFileSystem();
    this.store = new PipelineStateStore(this.specDir, { fs: this.fs });
    this.lock = new SpecLock(this.specDir, { fs: this.fs });
    this.workflow = loadWorkflow(this.projectRoot, this.fs);
  }

  // ── 状态查询（无副作用）───────────────────────────────────────────────────

  /** 获取完整快照 */
  snapshot() {
    return this.store.snapshot();
  }

  /** 获取当前阶段 */
  currentStage() {
    const state = this.store.read();
    if (state) return state.current_stage;
    return inferStageFromArtifacts(this.specDir, this.fs);
  }

  /** 获取流水线步骤定义 */
  getSteps(pipelineType = null) {
    if (!this.workflow) return [];
    const type = pipelineType || this.store.read()?.pipeline_type || this.workflow.defaults.pipeline_type;
    return this.workflow.pipelines[type] || [];
  }

  /** 获取当前阶段之后的下一步 */
  nextStep(currentStageId = null) {
    const stage = currentStageId || this.currentStage();
    const steps = this.getSteps();
    const idx = steps.findIndex(s => s.id === stage);
    if (idx < 0 || idx >= steps.length - 1) return null;
    return steps[idx + 1];
  }

  /** 判断是否是 human-approval gate */
  isGate(stageId = null) {
    const stage = stageId || this.currentStage();
    const steps = this.getSteps();
    const step = steps.find(s => s.id === stage);
    return step?.gate === 'human-approval';
  }

  // ── 带副作用的操作（需要 lock）──────────────────────────────────────────

  /**
   * 初始化流水线
   * @returns {{ ok: boolean, state?: object, error?: string }}
   */
  initialize(pipelineType = null) {
    const type = pipelineType || this.workflow?.defaults?.pipeline_type || 'feature';
    const version = this._readVersion();
    const steps = this.getSteps(type);
    const firstStage = steps[0]?.id || 'brainstorming';
    const state = this.store.init(type, version, firstStage);
    return { ok: true, state };
  }

  /**
   * 尝试推进到下一阶段
   * @returns {{ ok: boolean, from?: string, to?: string, error?: string, missing?: string[] }}
   */
  advance() {
    const state = this.store.read();
    if (!state) return { ok: false, error: 'Pipeline not initialized. Run: loom run --init', hint: '执行 loom run --spec-dir <spec目录> 初始化流水线' };

    const current = state.current_stage;

    // 失败状态不能自动推进
    if (current === 'failed') {
      return { ok: false, error: 'Pipeline is in failed state. Use: loom run --recover <stage>', hint: '执行 loom run --spec-dir <spec目录> --recover <阶段名> 从失败恢复' };
    }

    // 找下一步
    const next = this.nextStep(current);
    if (!next) {
      return { ok: false, error: `No next step after "${current}". Pipeline may be complete.`, hint: '流水线可能已完成，检查当前阶段状态' };
    }

    // 如果当前是 gate，必须由用户确认（不能自动跳过）
    if (this.isGate(current)) {
      return { ok: false, error: `Stage "${current}" is a human-approval gate. Use: loom run --approve`, hint: '执行 loom run --spec-dir <spec目录> --approve 通过审批门禁' };
    }

    // 从 step 定义读当前阶段产物
    const steps = this.getSteps();
    const currentStep = steps.find(s => s.id === current);
    const outputCheck = checkStageOutputs(this.specDir, currentStep?.outputs ?? [], this.fs);
    if (!outputCheck.ok) {
      const reasons = [];
      if (outputCheck.missing.length > 0) reasons.push(`missing: ${outputCheck.missing.join(', ')}`);
      if (outputCheck.withPlaceholders.length > 0) reasons.push(`placeholders in: ${outputCheck.withPlaceholders.join(', ')}`);
      return { ok: false, error: `Stage "${current}" outputs incomplete: ${reasons.join('; ')}`, hint: `确保当前阶段的产物文件已创建且无 TBD/TODO/FIXME/XXX 占位符。缺失: ${outputCheck.missing.join(', ')}，有占位符: ${outputCheck.withPlaceholders.join(', ')}` };
    }

    // 声明式 verdict 门禁（gate_verdict 在当前 step 声明）
    if (currentStep?.gate_verdict) {
      if (!isReportPassing(this.specDir, currentStep.gate_verdict, this.fs)) {
        return { ok: false, error: `${currentStep.gate_verdict} does not contain PASS verdict. Fix before advancing.`, hint: `在 ${currentStep.gate_verdict} 中添加 PASS 判定后再推进` };
      }
    }

    // 检查下一阶段的前置条件（requires 在 next step 声明）
    const preCheck = checkPreconditions(this.specDir, next.requires ?? [], this.fs);
    if (!preCheck.ok) {
      return { ok: false, error: `Preconditions for "${next.id}" not met: ${preCheck.missing.join(', ')}`, hint: `先完成前置条件中缺少的产物: ${preCheck.missing.join(', ')}` };
    }

    // 推进
    this.store.transition(next.id);
    this._recordCompliance(current);
    return { ok: true, from: current, to: next.id };
  }

  /**
   * 审批通过（针对 human-approval gate）
   */
  approve() {
    const state = this.store.read();
    if (!state) return { ok: false, error: 'Pipeline not initialized', hint: '执行 loom run --spec-dir <spec目录> 初始化流水线' };

    if (!this.isGate(state.current_stage)) {
      return { ok: false, error: `Stage "${state.current_stage}" is not a gate. No approval needed.`, hint: '当前阶段不是审批门禁，可以直接推进' };
    }

    const next = this.nextStep();
    if (!next) return { ok: false, error: 'No next step after gate', hint: '检查 workflow.yaml 中 gate 后的步骤配置' };

    this.store.transition(next.id, { history: { approval: 'user_confirmed' } });
    return { ok: true, from: state.current_stage, to: next.id };
  }

  /**
   * 从失败状态恢复到指定阶段
   */
  recover(targetStage) {
    const state = this.store.read();
    if (!state) return { ok: false, error: 'Pipeline not initialized', hint: '执行 loom run --spec-dir <spec目录> 初始化流水线' };
    if (state.current_stage !== 'failed') {
      return { ok: false, error: `Pipeline is in "${state.current_stage}", not "failed"`, hint: '只有处于 failed 状态的流水线才能 recover' };
    }

    const steps = this.getSteps();
    const valid = steps.find(s => s.id === targetStage);
    if (!valid) return { ok: false, error: `"${targetStage}" is not a valid stage`, hint: `可用阶段: ${steps.map(s => s.id).join(', ')}` };

    this.store.transition(targetStage, { history: { recovery_from: 'failed' } });
    return { ok: true, from: 'failed', to: targetStage };
  }

  /**
   * 标记当前阶段失败
   */
  markFailed(reason) {
    const state = this.store.read();
    if (!state) return { ok: false, error: 'Pipeline not initialized', hint: '执行 loom run --spec-dir <spec目录> 初始化流水线' };
    this.store.fail(reason, state.current_stage);
    this._recordCompliance(state.current_stage, false, reason);
    return { ok: true, stage: state.current_stage, reason };
  }

  /**
   * 获取给 AI 的阶段上下文摘要（MCP 用）
   */
  getStageContext() {
    const state = this.store.read();
    if (!state) return null;

    const steps = this.getSteps();
    const currentStep = steps.find(s => s.id === state.current_stage);
    const nextStep = this.nextStep();
    const tasks = this.store.readAllTasks();

    return {
      spec_dir: this.specDir,
      pipeline_type: state.pipeline_type,
      current_stage: state.current_stage,
      current_skill: currentStep?.skill || null,
      is_gate: this.isGate(),
      next_stage: nextStep?.id || null,
      defaults: this.workflow?.defaults || {},
      tasks_summary: {
        total: tasks.length,
        pending: tasks.filter(t => t.status === 'pending').length,
        executing: tasks.filter(t => t.status === 'executing').length,
        done: tasks.filter(t => t.status === 'done').length,
        failed: tasks.filter(t => t.status === 'failed').length,
        blocked: tasks.filter(t => t.status === 'blocked').length
      },
      started_at: state.started_at,
      updated_at: state.updated_at
    };
  }

  // ── 内部工具 ──────────────────────────────────────────────────────────────

  _readVersion() {
    try {
      const pkg = JSON.parse(this.fs.readFileSync(join(this.projectRoot, 'package.json'), 'utf-8'));
      return pkg.version || '2.0.0';
    } catch { return '2.0.0'; }
  }

  _stageToSkill(stage) {
    const map = {
      brainstorming: 'loom-brainstorming',
      planning: 'loom-writing-plans',
      'git-worktree': 'loom-using-git-worktrees',
      executing: 'loom-subagent-driven-development',
      verification: 'loom-verification-before-completion',
      synced: 'loom-index-update'
    };
    return map[stage] || stage;
  }

  _recordCompliance(stage, passed = true, reason = '') {
    try {
      const tracker = new ComplianceTracker(this.projectRoot, { fs: this.fs });
      if (passed) {
        tracker.recordFromVerifyReport(this.specDir);
      } else {
        tracker.record(this.specDir, stage, this._stageToSkill(stage), false, [reason]);
      }
    } catch {}
  }
}
