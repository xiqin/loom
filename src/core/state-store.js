/**
 * state-store.js — 每个 spec 的状态读写
 *
 * 设计原则：状态写入者唯一
 *   - pipeline.state.json  → 只由管理该 spec 的 loom run 进程写
 *   - task-states/TN.state.json → 只由该 task 的 subagent 写（通过 loom task-state 子命令）
 *   - progress.md          → 由 state-store 汇总生成，不由 AI 直接写
 */

import {
  existsSync, readFileSync, writeFileSync,
  mkdirSync, readdirSync, renameSync, rmSync
} from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

// ── 常量 ───────────────────────────────────────────────────────────────────

export const TASK_STATUSES = ['pending', 'executing', 'reviewing', 'done', 'failed', 'blocked'];

// ── 工具函数 ───────────────────────────────────────────────────────────────

/**
 * 读 JSON。
 * - 文件不存在 → 返回 fallback（正常的"未初始化"）
 * - 文件存在但解析失败 → 抛错（损坏状态绝不能被静默当成不存在，否则会被覆盖丢失）
 */
function readJSON(path, fallback = null) {
  if (!existsSync(path)) return fallback;
  let raw;
  try { raw = readFileSync(path, 'utf-8'); }
  catch { return fallback; }
  try { return JSON.parse(raw); }
  catch (err) {
    throw new Error(`Corrupt state file: ${path} (${err.message}). Fix or delete it manually.`);
  }
}

/** 读 JSON，损坏时跳过并告警（用于批量读取 task 列表，单个坏文件不应中断全部）*/
function readJSONLenient(path) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); }
  catch (err) {
    process.stderr.write(`[loom] skipping unreadable state file ${path}: ${err.message}\n`);
    return null;
  }
}

/** 原子写：写临时文件后 rename，避免进程中途崩导致半写 JSON */
function writeJSON(path, data) {
  const tmp = `${path}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  const payload = JSON.stringify(data, null, 2) + '\n';
  try {
    writeFileSync(tmp, payload, 'utf-8');
    renameSync(tmp, path); // rename 在同一文件系统上是原子的
  } catch (err) {
    try { rmSync(tmp, { force: true }); } catch {}
    throw err;
  }
}

function now() { return new Date().toISOString(); }

// ── PipelineStateStore ─────────────────────────────────────────────────────

export class PipelineStateStore {
  /**
   * @param {string} specDir  绝对或相对路径，e.g. "specs/2026-05-27+user-auth"
   */
  constructor(specDir) {
    this.specDir = specDir;
    this.statePath = join(specDir, 'pipeline.state.json');
    this.taskStatesDir = join(specDir, 'task-states');
    this.handoffsDir = join(specDir, 'handoffs');
  }

  // ── 流水线状态 ────────────────────────────────────────────────────────────

  /** 读取流水线状态，不存在返回 null */
  read() {
    return readJSON(this.statePath);
  }

  /** 初始化（首次创建）*/
  init(pipelineType = 'feature', loomVersion = '2.0.0', firstStage = 'brainstorming') {
    if (existsSync(this.statePath)) return this.read();
    mkdirSync(this.specDir, { recursive: true });
    const state = {
      spec_dir: this.specDir,
      pipeline_type: pipelineType,
      current_stage: firstStage,
      loom_version: loomVersion,
      started_at: now(),
      updated_at: now(),
      stage_history: [],
      metadata: {}
    };
    writeJSON(this.statePath, state);
    return state;
  }

  /** 推进到新阶段 */
  transition(toStage, meta = {}) {
    const state = this.read() || this.init();
    const prevStage = state.current_stage;

    // 记录历史
    state.stage_history.push({
      stage: prevStage,
      entered_at: state.current_stage_started_at || state.started_at,
      exited_at: now(),
      status: 'passed',
      ...meta.history
    });

    state.current_stage = toStage;
    state.current_stage_started_at = now();
    state.updated_at = now();
    if (meta.data) Object.assign(state.metadata, meta.data);

    writeJSON(this.statePath, state);
    this._rebuildProgress();
    return state;
  }

  /** 标记当前阶段失败 */
  fail(reason, fromStage = null) {
    const state = this.read();
    if (!state) return;

    state.stage_history.push({
      stage: fromStage || state.current_stage,
      entered_at: state.current_stage_started_at || state.started_at,
      exited_at: now(),
      status: 'failed',
      reason
    });
    state.current_stage = 'failed';
    state.current_stage_started_at = now();
    state.updated_at = now();
    state.failure_reason = reason;

    writeJSON(this.statePath, state);
    this._rebuildProgress();
  }

  // ── Task 状态 ─────────────────────────────────────────────────────────────

  /** 初始化单个 task 状态 */
  initTask(taskId, agentSessionId = null) {
    mkdirSync(this.taskStatesDir, { recursive: true });
    const path = join(this.taskStatesDir, `${taskId}.state.json`);
    if (existsSync(path)) return readJSON(path);

    const state = {
      task_id: taskId,
      spec_dir: this.specDir,
      status: 'pending',
      retry_count: 0,
      agent_session_id: agentSessionId,
      created_at: now(),
      updated_at: now(),
      last_reviewer_result: null,
      blocker: null
    };
    writeJSON(path, state);
    return state;
  }

  /** 更新 task 状态（只有该 task 的负责方调用）*/
  updateTask(taskId, patch) {
    mkdirSync(this.taskStatesDir, { recursive: true });
    const path = join(this.taskStatesDir, `${taskId}.state.json`);
    const state = readJSON(path) || this.initTask(taskId);
    Object.assign(state, patch, { updated_at: now() });
    writeJSON(path, state);
    this._rebuildProgress();
    return state;
  }

  /** 读取所有 task 状态 */
  readAllTasks() {
    if (!existsSync(this.taskStatesDir)) return [];
    return readdirSync(this.taskStatesDir)
      .filter(f => f.endsWith('.state.json'))
      .map(f => readJSONLenient(join(this.taskStatesDir, f)))
      .filter(Boolean)
      .sort((a, b) => {
        const na = parseInt(a.task_id?.replace(/\D/g, '') || '0');
        const nb = parseInt(b.task_id?.replace(/\D/g, '') || '0');
        return na - nb;
      });
  }

  /** 读取单个 task 状态 */
  readTask(taskId) {
    const path = join(this.taskStatesDir, `${taskId}.state.json`);
    return readJSON(path);
  }

  // ── Handoff ────────────────────────────────────────────────────────────────

  writeHandoff(taskId, handoff) {
    mkdirSync(this.handoffsDir, { recursive: true });
    writeJSON(join(this.handoffsDir, `${taskId}.json`), {
      ...handoff,
      task_id: taskId,
      written_at: now()
    });
  }

  readHandoff(taskId) {
    return readJSON(join(this.handoffsDir, `${taskId}.json`));
  }

  readAllHandoffs() {
    if (!existsSync(this.handoffsDir)) return [];
    return readdirSync(this.handoffsDir)
      .filter(f => f.endsWith('.json'))
      .map(f => readJSONLenient(join(this.handoffsDir, f)))
      .filter(Boolean);
  }

  // ── Progress.md 汇总生成 ───────────────────────────────────────────────────

  _rebuildProgress() {
    const pipeline = this.read();
    const tasks = this.readAllTasks();
    const lines = [];

    lines.push('# Progress');
    lines.push('');
    lines.push(`> Auto-generated by loom. Do not edit manually.`);
    lines.push(`> Last updated: ${now()}`);
    lines.push('');

    if (pipeline) {
      lines.push(`## Pipeline`);
      lines.push('');
      lines.push(`| Field | Value |`);
      lines.push(`|-------|-------|`);
      lines.push(`| Stage | \`${pipeline.current_stage}\` |`);
      lines.push(`| Type  | \`${pipeline.pipeline_type}\` |`);
      lines.push(`| Started | ${pipeline.started_at?.slice(0, 16).replace('T', ' ')} |`);
      lines.push(`| Updated | ${pipeline.updated_at?.slice(0, 16).replace('T', ' ')} |`);
      if (pipeline.failure_reason) {
        lines.push(`| Failure | ${pipeline.failure_reason} |`);
      }
      lines.push('');

      if (pipeline.stage_history?.length > 0) {
        lines.push('### Stage History');
        lines.push('');
        lines.push('| Stage | Status | Exited |');
        lines.push('|-------|--------|--------|');
        for (const h of pipeline.stage_history) {
          const icon = h.status === 'passed' ? '✅' : '❌';
          lines.push(`| \`${h.stage}\` | ${icon} ${h.status} | ${h.exited_at?.slice(0, 16).replace('T', ' ')} |`);
        }
        lines.push('');
      }
    }

    if (tasks.length > 0) {
      lines.push('## Tasks');
      lines.push('');
      lines.push('| Task | Status | Retries | Updated |');
      lines.push('|------|--------|---------|---------|');

      const statusIcon = {
        pending: '⏳', executing: '▶', reviewing: '🔍',
        done: '✅', failed: '❌', blocked: '🚫'
      };

      for (const t of tasks) {
        const icon = statusIcon[t.status] || '?';
        const retries = t.retry_count ?? 0;
        const updated = t.updated_at?.slice(0, 16).replace('T', ' ') || '-';
        lines.push(`| \`${t.task_id}\` | ${icon} ${t.status} | ${retries} | ${updated} |`);
      }
      lines.push('');

      const blocked = tasks.filter(t => t.blocker);
      if (blocked.length > 0) {
        lines.push('### Blockers');
        lines.push('');
        for (const t of blocked) {
          lines.push(`- **${t.task_id}**: ${t.blocker}`);
        }
        lines.push('');
      }
    }

    writeFileSync(join(this.specDir, 'progress.md'), lines.join('\n'), 'utf-8');
  }

  // ── 汇总快照（用于 loom status）──────────────────────────────────────────

  snapshot() {
    return {
      spec_dir: this.specDir,
      pipeline: this.read(),
      tasks: this.readAllTasks(),
      handoffs: this.readAllHandoffs()
    };
  }
}

// ── 全局扫描（用于 loom status --all）────────────────────────────────────

export function scanAllSpecs(projectRoot) {
  const specsDir = join(projectRoot, 'specs');
  if (!existsSync(specsDir)) return [];
  return readdirSync(specsDir, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => {
      const specDir = join(specsDir, e.name);
      const store = new PipelineStateStore(specDir);
      try { return store.snapshot(); }
      catch (err) {
        // 单个 spec 损坏不应中断全局扫描
        process.stderr.write(`[loom] skipping spec ${e.name}: ${err.message}\n`);
        return { spec_dir: specDir, pipeline: null, tasks: [], handoffs: [] };
      }
    })
    .filter(s => s.pipeline !== null)  // 只返回有 pipeline.state.json 的
    .sort((a, b) => {
      const da = a.pipeline?.started_at || '';
      const db = b.pipeline?.started_at || '';
      return db.localeCompare(da); // 最新在前
    });
}
