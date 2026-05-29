/**
 * tools.js — MCP 工具定义
 *
 * 8 个工具覆盖五个方向的核心能力。
 * 每个工具是一个纯函数，接收参数返回结果，不持有状态。
 */

import { resolve, join, sep } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { PipelineEngine } from '../core/pipeline-engine.js';
import { PipelineStateStore, scanAllSpecs } from '../core/state-store.js';
import { MemoryStore } from '../core/memory-store.js';
import { SpecLock } from '../core/lock.js';

/**
 * 把 specDir 解析为绝对路径，并强制限制在 projectRoot 内。
 * MCP 工具的 spec_dir 来自 AI 输入，未经校验会被 "../../etc" 逃逸到项目外读写。
 */
function safeResolveSpecDir(projectRoot, specDir) {
  const root = resolve(projectRoot);
  const abs = resolve(root, specDir);
  if (abs !== root && !abs.startsWith(root + sep)) {
    throw new Error(`spec_dir escapes project root: ${specDir}`);
  }
  return abs;
}

/** 在 spec 锁保护下执行写操作；拿不到锁则返回 busy 错误，不破坏单一写入者约束 */
function withSpecLock(absSpecDir, fn) {
  const lock = new SpecLock(absSpecDir);
  const res = lock.acquire();
  if (!res.acquired) {
    return { error: `spec is locked by PID ${res.pid} (started: ${res.startedAt || 'unknown'})` };
  }
  try { return fn(); }
  finally { lock.release(); }
}

// ── 工具定义 ───────────────────────────────────────────────────────────────

export const TOOL_DEFINITIONS = [
  {
    name: 'loom_get_project_status',
    description: 'Get the loom status of the current project: active pipelines, stages, task summaries, and health issues.',
    inputSchema: {
      type: 'object',
      properties: {
        project_root: { type: 'string', description: 'Project root directory (optional if attached)' }
      }
    }
  },
  {
    name: 'loom_get_pipeline_context',
    description: 'Get the current pipeline stage context for a spec: stage, skill, tasks, defaults. Use this to understand what to do next.',
    inputSchema: {
      type: 'object',
      properties: {
        spec_dir: { type: 'string', description: 'Path to spec directory (optional if attached)' }
      }
    }
  },
  {
    name: 'loom_advance_pipeline',
    description: 'Advance the pipeline to the next stage. Validates artifacts before advancing. Returns error if preconditions not met.',
    inputSchema: {
      type: 'object',
      properties: {
        spec_dir: { type: 'string', description: 'Path to spec directory (optional if attached)' }
      }
    }
  },
  {
    name: 'loom_approve_gate',
    description: 'Approve a human-approval gate (e.g. after user confirms plan). Only works when current stage is a gate.',
    inputSchema: {
      type: 'object',
      properties: {
        spec_dir: { type: 'string', description: 'Path to spec directory (optional if attached)' }
      }
    }
  },
  {
    name: 'loom_update_task_state',
    description: 'Update a single task state. Only the responsible subagent should call this.',
    inputSchema: {
      type: 'object',
      properties: {
        spec_dir: { type: 'string', description: 'Path to spec directory (optional if attached)' },
        task_id: { type: 'string', description: 'Task ID (e.g. T1)' },
        status: { type: 'string', enum: ['pending', 'executing', 'reviewing', 'done', 'failed', 'blocked'] },
        blocker: { type: 'string', description: 'Blocker reason (when status is blocked)' }
      },
      required: ['task_id', 'status']
    }
  },
  {
    name: 'loom_get_memory',
    description: 'Read project memory entries: gotchas, decisions, preferences. Filter by type.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Filter: 决策, 踩坑, 偏好, 状态, adr' },
        limit: { type: 'number', description: 'Max entries (default 10)' }
      }
    }
  },
  {
    name: 'loom_add_memory',
    description: 'Write a new memory entry (decision, gotcha, preference).',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['决策', '踩坑', '偏好', '状态', 'adr'], description: 'Memory type' },
        content: { type: 'string', description: 'One-line description' },
        context: { type: 'string', description: 'Background/reason (optional, for ADRs)' }
      },
      required: ['type', 'content']
    }
  },
  {
    name: 'loom_attach_spec',
    description: 'Bind this session to a specific spec directory. Subsequent calls can omit spec_dir.',
    inputSchema: {
      type: 'object',
      properties: {
        spec_dir: { type: 'string', description: 'Path to spec directory' },
        project_root: { type: 'string', description: 'Project root directory' }
      },
      required: ['spec_dir']
    }
  }
];

// ── 工具执行 ───────────────────────────────────────────────────────────────

export function executeToolCall(toolName, args, sessionStore, sessionId) {
  const specDir = sessionStore.resolveSpecDir(sessionId, args.spec_dir);
  const projectRoot = sessionStore.resolveProjectRoot(sessionId, args.project_root);

  switch (toolName) {

    case 'loom_get_project_status': {
      const root = args.project_root || projectRoot;
      const allSpecs = scanAllSpecs(root);
      // health checks
      const issues = [];
      const constPath = join(root, '.loom', 'rules', 'constitution.md');
      if (existsSync(constPath)) {
        const c = readFileSync(constPath, 'utf-8');
        const ph = c.match(/\{\{[A-Z_]+\}\}/g);
        if (ph) issues.push(`constitution.md has ${ph.length} unrendered placeholders`);
      }
      if (!existsSync(join(root, '.loom', 'workflow.yaml'))) {
        issues.push('Missing .loom/workflow.yaml');
      }
      return {
        project_root: root,
        active_pipelines: allSpecs.length,
        pipelines: allSpecs.map(s => ({
          spec_dir: s.spec_dir,
          stage: s.pipeline?.current_stage,
          pipeline_type: s.pipeline?.pipeline_type,
          tasks_total: s.tasks.length,
          tasks_done: s.tasks.filter(t => t.status === 'done').length,
          updated_at: s.pipeline?.updated_at
        })),
        health_issues: issues
      };
    }

    case 'loom_get_pipeline_context': {
      if (!specDir) return { error: 'No spec_dir. Call loom_attach_spec first or pass spec_dir.' };
      const engine = new PipelineEngine(projectRoot, safeResolveSpecDir(projectRoot, specDir));
      const ctx = engine.getStageContext();
      if (!ctx) return { error: 'Pipeline not initialized' };
      return ctx;
    }

    case 'loom_advance_pipeline': {
      if (!specDir) return { error: 'No spec_dir' };
      const abs = safeResolveSpecDir(projectRoot, specDir);
      return withSpecLock(abs, () => new PipelineEngine(projectRoot, abs).advance());
    }

    case 'loom_approve_gate': {
      if (!specDir) return { error: 'No spec_dir' };
      const abs = safeResolveSpecDir(projectRoot, specDir);
      return withSpecLock(abs, () => new PipelineEngine(projectRoot, abs).approve());
    }

    case 'loom_update_task_state': {
      if (!specDir) return { error: 'No spec_dir' };
      const abs = safeResolveSpecDir(projectRoot, specDir);
      const store = new PipelineStateStore(abs);
      const patch = { status: args.status };
      if (args.blocker) patch.blocker = args.blocker;
      if (args.status === 'failed') {
        const current = store.readTask(args.task_id);
        if (current) patch.retry_count = (current.retry_count || 0) + 1;
      }
      const state = store.updateTask(args.task_id, patch);
      return { ok: true, task: state };
    }

    case 'loom_get_memory': {
      const memStore = new MemoryStore(join(projectRoot, '.loom'));
      return memStore.list({ type: args.type, limit: args.limit || 10 });
    }

    case 'loom_add_memory': {
      const memStore = new MemoryStore(join(projectRoot, '.loom'));
      const entry = memStore.add(args.type, args.content, { context: args.context });
      return { ok: true, entry };
    }

    case 'loom_attach_spec': {
      sessionStore.attach(sessionId, args.spec_dir, args.project_root || projectRoot);
      return { ok: true, attached: args.spec_dir };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
