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

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PipelineStateStore } from './state-store.js';
import { SpecLock } from './lock.js';
import {
  checkPreconditions, checkStageOutputs,
  isTestReportPassing, isVerifyReportPassing,
  inferStageFromArtifacts
} from './artifact-checker.js';

// ── Workflow 解析 ──────────────────────────────────────────────────────────

/**
 * 简易 YAML 解析：逐行缩进解析，覆盖 loom workflow.yaml 的完整结构。
 * 只处理 loom 约定的固定两级结构（defaults + pipelines.*.steps[]），
 * 不引入第三方依赖。
 */
/** 去行内注释，但不剥离引号内的 #（避免破坏 "url#anchor" 这类值）*/
function stripComment(line) {
  let inSingle = false, inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === '#' && !inSingle && !inDouble) return line.slice(0, i);
  }
  return line;
}

function parseWorkflowYaml(content) {
  const result = { defaults: {}, pipelines: {} };
  const lines = content.split('\n');

  // Pass 1: 提取 defaults 块的 key: value
  let inDefaults = false;
  for (const line of lines) {
    const stripped = stripComment(line);  // 去注释
    if (/^defaults:\s*$/.test(stripped)) { inDefaults = true; continue; }
    if (inDefaults) {
      if (/^\S/.test(stripped) && stripped.trim()) { inDefaults = false; continue; }
      const m = stripped.match(/^\s+([\w_]+):\s*(.+)/);
      if (m) {
        const val = m[2].trim();
        result.defaults[m[1]] = /^\d+$/.test(val) ? parseInt(val) : val;
      }
    }
  }

  // Pass 2: 提取 pipeline 块
  let currentPipeline = null;
  let inSteps = false;
  let currentStep = null;

  for (const raw of lines) {
    const line = stripComment(raw); // 去注释
    if (!line.trim()) continue;

    // 检测 pipeline 名称（2 空格缩进直接在 pipelines 下）
    const plMatch = line.match(/^  (\w[\w-]*):\s*$/);
    if (plMatch) {
      const name = plMatch[1];
      if (name !== 'description' && name !== 'steps') {
        // 新 pipeline 开始 → 关闭上一个的 steps 状态
        currentPipeline = name;
        result.pipelines[currentPipeline] = result.pipelines[currentPipeline] || [];
        inSteps = false;
        currentStep = null;
        continue;
      }
    }

    // 检测 steps: 开始
    if (/^\s+steps:\s*$/.test(line) && currentPipeline) {
      inSteps = true;
      currentStep = null;
      continue;
    }

    // 在 steps 块内
    if (inSteps && currentPipeline) {
      // 新 step 开始：- id: xxx
      const idMatch = line.match(/^\s+- id:\s*(\S+)/);
      if (idMatch) {
        currentStep = { id: idMatch[1], skill: null, gate: null, next: null, description: '' };
        result.pipelines[currentPipeline].push(currentStep);
        continue;
      }

      // step 属性
      if (currentStep) {
        const attrMatch = line.match(/^\s+(skill|gate|next|description):\s*"?([^"]*)"?\s*$/);
        if (attrMatch) {
          currentStep[attrMatch[1]] = attrMatch[2].trim() || null;
          continue;
        }
        // config 子块中的属性（如 max_retries）
        const cfgMatch = line.match(/^\s+(max_retries|timeout_minutes):\s*(\d+)/);
        if (cfgMatch) {
          currentStep.config = currentStep.config || {};
          currentStep.config[cfgMatch[1]] = parseInt(cfgMatch[2]);
        }
      }

      // 非 step 行但缩进回退到 pipeline 级别 → steps 块结束
      if (/^  \S/.test(line)) {
        inSteps = false;
        currentStep = null;
      }
    }
  }

  return result;
}

export function loadWorkflow(projectRoot) {
  const wfPath = join(projectRoot, '.loom', 'workflow.yaml');
  if (!existsSync(wfPath)) return null;
  const parsed = parseWorkflowYaml(readFileSync(wfPath, 'utf-8'));
  // 解析出 0 条 pipeline 几乎一定是格式/缩进问题 → 大声报错，不要静默返回空导致全盘失效
  if (Object.keys(parsed.pipelines).length === 0) {
    throw new Error(
      `Failed to parse any pipelines from ${wfPath}. ` +
      `Check indentation (2-space) and structure (pipelines: <name>: steps: - id: ...).`
    );
  }
  return parsed;
}

// ── PipelineEngine ─────────────────────────────────────────────────────────

export class PipelineEngine {
  /**
   * @param {string} projectRoot  项目根目录
   * @param {string} specDir      specs/<date+feature> 的绝对路径
   */
  constructor(projectRoot, specDir) {
    this.projectRoot = resolve(projectRoot);
    this.specDir = resolve(specDir);
    this.store = new PipelineStateStore(this.specDir);
    this.lock = new SpecLock(this.specDir);
    this.workflow = loadWorkflow(this.projectRoot);
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
    return inferStageFromArtifacts(this.specDir);
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
    const state = this.store.init(type, version);
    return { ok: true, state };
  }

  /**
   * 尝试推进到下一阶段
   * @returns {{ ok: boolean, from?: string, to?: string, error?: string, missing?: string[] }}
   */
  advance() {
    const state = this.store.read();
    if (!state) return { ok: false, error: 'Pipeline not initialized. Run: loom run --init' };

    const current = state.current_stage;

    // 失败状态不能自动推进
    if (current === 'failed') {
      return { ok: false, error: 'Pipeline is in failed state. Use: loom run --recover <stage>' };
    }

    // 找下一步
    const next = this.nextStep(current);
    if (!next) {
      return { ok: false, error: `No next step after "${current}". Pipeline may be complete.` };
    }

    // 如果当前是 gate，必须由用户确认（不能自动跳过）
    if (this.isGate(current)) {
      return { ok: false, error: `Stage "${current}" is a human-approval gate. Use: loom run --approve` };
    }

    // 检查当前阶段的产物是否落地
    const outputCheck = checkStageOutputs(this.specDir, current);
    if (!outputCheck.ok) {
      const reasons = [];
      if (outputCheck.missing.length > 0) reasons.push(`missing: ${outputCheck.missing.join(', ')}`);
      if (outputCheck.withPlaceholders.length > 0) reasons.push(`placeholders in: ${outputCheck.withPlaceholders.join(', ')}`);
      return { ok: false, error: `Stage "${current}" outputs incomplete: ${reasons.join('; ')}` };
    }

    // 特殊检查：verification 需要 test-report PASS
    if (current === 'executing' && next.id === 'verification') {
      if (!isTestReportPassing(this.specDir)) {
        return { ok: false, error: 'test-report.md does not contain PASS verdict. Fix tests before advancing.' };
      }
    }

    // 特殊检查：synced 需要 verify-report PASS
    if (current === 'verification' && next.id === 'synced') {
      if (!isVerifyReportPassing(this.specDir)) {
        return { ok: false, error: 'verify-report.md does not contain PASS verdict. Fix blockers before advancing.' };
      }
    }

    // 检查下一阶段的前置条件
    const preCheck = checkPreconditions(this.specDir, next.id);
    if (!preCheck.ok) {
      return { ok: false, error: `Preconditions for "${next.id}" not met: ${preCheck.missing.join(', ')}` };
    }

    // 推进
    this.store.transition(next.id);
    return { ok: true, from: current, to: next.id };
  }

  /**
   * 审批通过（针对 human-approval gate）
   */
  approve() {
    const state = this.store.read();
    if (!state) return { ok: false, error: 'Pipeline not initialized' };

    if (!this.isGate(state.current_stage)) {
      return { ok: false, error: `Stage "${state.current_stage}" is not a gate. No approval needed.` };
    }

    const next = this.nextStep();
    if (!next) return { ok: false, error: 'No next step after gate' };

    this.store.transition(next.id, { history: { approval: 'user_confirmed' } });
    return { ok: true, from: state.current_stage, to: next.id };
  }

  /**
   * 从失败状态恢复到指定阶段
   */
  recover(targetStage) {
    const state = this.store.read();
    if (!state) return { ok: false, error: 'Pipeline not initialized' };
    if (state.current_stage !== 'failed') {
      return { ok: false, error: `Pipeline is in "${state.current_stage}", not "failed"` };
    }

    const steps = this.getSteps();
    const valid = steps.find(s => s.id === targetStage);
    if (!valid) return { ok: false, error: `"${targetStage}" is not a valid stage` };

    this.store.transition(targetStage, { history: { recovery_from: 'failed' } });
    return { ok: true, from: 'failed', to: targetStage };
  }

  /**
   * 标记当前阶段失败
   */
  markFailed(reason) {
    const state = this.store.read();
    if (!state) return { ok: false, error: 'Pipeline not initialized' };
    this.store.fail(reason, state.current_stage);
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
      const pkg = JSON.parse(readFileSync(join(this.projectRoot, 'package.json'), 'utf-8'));
      return pkg.version || '2.0.0';
    } catch { return '2.0.0'; }
  }
}
