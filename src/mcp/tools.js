/**
 * tools.js — MCP 工具定义
 *
 * 工具按 group 分组（pipeline / context / memory / session / meta），
 * 配合 loom_list_capabilities 做"虚拟 Skill"按需加载，减少上下文占用。
 * 每个工具是一个纯函数，接收参数返回结果，不持有状态。
 */

import { resolve, join, sep, dirname } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NodeFileSystem } from '../core/fs-interface.js';
import { PipelineEngine } from '../core/pipeline-engine.js';
import { PipelineStateStore, scanAllSpecs } from '../core/state-store.js';
import { MemoryStore } from '../core/memory-store.js';
import { SpecLock } from '../core/lock.js';
import { loadContextIndex, DOC_KEYS } from '../core/context-index.js';
import { SkillLoader } from '../core/skill-loader.js';
import { PipelineSelector } from '../core/pipeline-selector.js';
import { getSnapshot } from './telemetry.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = join(__dirname, '..', '..', 'skills');

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

/** 在 spec 锁保护下执行写操作；拿不到锁则带重试等待 */
async function withSpecLock(absSpecDir, fn, fsImpl) {
  const lock = new SpecLock(absSpecDir, { fs: fsImpl });
  const res = await lock.acquireWithRetry();
  if (!res.acquired) {
    return { error: `spec is locked by PID ${res.pid} (started: ${res.startedAt || 'unknown'})` };
  }
  try { return fn(); }
  finally { lock.release(); }
}

// ── 工具定义 ───────────────────────────────────────────────────────────────

export const TOOL_DEFINITIONS = [
  {
    name: 'loom_list_capabilities',
    group: 'meta',
    description: 'START HERE. Returns a grouped catalog of loom capabilities (pipeline, context, memory, retrieval) so you can load only the tools relevant to the task instead of scanning every tool.',
    inputSchema: {
      type: 'object',
      properties: {
        project_root: { type: 'string', description: 'Project root directory (optional if attached)' }
      }
    }
  },
  {
    name: 'loom_get_context',
    group: 'context',
    description: 'Progressive disclosure of context files. Without a section, returns the OUTLINE (L0: section titles + token sizes). With a section, returns that section full text (L1). Auto-falls back to the WHOLE file (with a "fallback" field) when a level would yield empty content — so you never lose info. Use this instead of reading whole constitution/index/memory files.',
    inputSchema: {
      type: 'object',
      properties: {
        doc: { type: 'string', description: `Context doc key: ${DOC_KEYS.join(', ')}` },
        section: { type: 'string', description: 'Section title to fetch full text (omit for outline)' },
        full: { type: 'boolean', description: 'Escape hatch: return the WHOLE file (use if outline/section seems to drop info, e.g. content before the first heading)' },
        project_root: { type: 'string', description: 'Project root directory (optional if attached)' }
      },
      required: ['doc']
    }
  },
  {
    name: 'loom_get_project_status',
    group: 'pipeline',
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
    group: 'pipeline',
    description: 'Get the current pipeline stage context for a spec: stage, skill, tasks, defaults. Use this to understand what to do next.',
    inputSchema: {
      type: 'object',
      properties: {
        spec_dir: { type: 'string', description: 'Path to spec directory (optional if attached)' }
      }
    }
  },
  {
    name: 'loom_select_pipeline',
    group: 'pipeline',
    description: 'AI 自主流程选择：根据用户需求 + 信号选择步骤组合（规则短路 → AI fallback → 规则兜底）。返回 steps 数组、风险等级、选择来源。未传 initialize=true 时只返回建议不写状态。',
    inputSchema: {
      type: 'object',
      properties: {
        request: { type: 'string', description: '用户原始需求描述' },
        spec_dir: { type: 'string', description: 'Path to spec directory (optional if attached)' },
        initialize: { type: 'boolean', description: 'true: 把选中的 steps 写入 pipeline.state.json (dynamic_steps)，初始化流水线。false (默认): 仅返回建议。' }
      },
      required: ['request']
    }
  },
  {
    name: 'loom_advance_pipeline',
    group: 'pipeline',
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
    group: 'pipeline',
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
    group: 'pipeline',
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
    group: 'memory',
    description: 'Read project memory entries: gotchas, decisions, preferences. Filter by type.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Filter: 决策, 踩坑, 偏好, 状态, adr' },
        limit: { type: 'number', description: 'Max entries (default 10)' },
        project_root: { type: 'string', description: 'Project root directory (optional if attached)' }
      }
    }
  },
  {
    name: 'loom_add_memory',
    group: 'memory',
    description: 'Write a new memory entry (decision, gotcha, preference).',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['决策', '踩坑', '偏好', '状态', 'adr'], description: 'Memory type' },
        content: { type: 'string', description: 'One-line description' },
        context: { type: 'string', description: 'Background/reason (optional, for ADRs)' },
        project_root: { type: 'string', description: 'Project root directory (optional if attached)' }
      },
      required: ['type', 'content']
    }
  },
  {
    name: 'loom_attach_spec',
    group: 'session',
    description: 'Bind this session to a specific spec directory. Subsequent calls can omit spec_dir.',
    inputSchema: {
      type: 'object',
      properties: {
        spec_dir: { type: 'string', description: 'Path to spec directory' },
        project_root: { type: 'string', description: 'Project root directory' }
      },
      required: ['spec_dir']
    }
  },
  {
    name: 'loom_load_tool_group',
    group: 'meta',
    description: 'Load a group of tools into the session. Use after loom_list_capabilities to activate the tool group you need (e.g. pipeline, context, memory, session).',
    inputSchema: {
      type: 'object',
      properties: {
        group: { type: 'string', description: 'Group name: context, pipeline, memory, session' }
      },
      required: ['group']
    }
  },
  {
    name: 'loom_get_skill_context',
    group: 'context',
    description: 'Progressive disclosure of skill files. Without a skill name, returns L0 summaries of ALL skills (name, summary, triggers, section titles — ~1.2K tokens total). With a skill name, returns the L1 full content of that skill. With skill name + section, returns just that section. Use this instead of loading all skill files into context.',
    inputSchema: {
      type: 'object',
      properties: {
        skill: { type: 'string', description: 'Skill name (e.g. brainstorming, writing-plans). Omit for L0 summaries of all skills.' },
        section: { type: 'string', description: 'Section title within a skill (e.g. 执行流程). Only valid when skill is specified.' }
      }
    }
  },
  {
    name: 'loom_telemetry',
    group: 'meta',
    description: 'Get telemetry snapshot for the current MCP session: tool call counts, cumulative time per tool. Only available when LOOM_TELEMETRY=1 is set.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

/**
 * 分组级"虚拟 Skill"描述（②）。模型先调 loom_list_capabilities 读这份目录，
 * 判断任务需要哪一组，再按需使用该组工具——而非把每个工具的细节都吃进上下文。
 */
export const CAPABILITY_GROUPS = {
  context: {
    title: '上下文（渐进式披露）',
    when: '需要项目宪章 / 结构化记忆里的某块信息时。先取目录（不带 section）看有什么，再按节召回，避免整文件进上下文。',
    tools: ['loom_get_context', 'loom_get_skill_context'],
  },
  pipeline: {
    title: '流水线（状态机）',
    when: '推进开发流程、查当前阶段该做什么、推进/审批/更新任务状态时。强调"状态感知"：先读 pipeline context 了解现状，再决定动作。',
    tools: ['loom_get_project_status', 'loom_get_pipeline_context', 'loom_select_pipeline', 'loom_advance_pipeline', 'loom_approve_gate', 'loom_update_task_state'],
  },
  memory: {
    title: '结构化记忆',
    when: '需要历史决策 / 踩坑 / 偏好，或要记录新结论时。读用 loom_get_memory，写用 loom_add_memory。',
    tools: ['loom_get_memory', 'loom_add_memory'],
  },
  retrieval: {
    title: '多路检索（codegraph，外部 MCP）',
    when: '需要符号定义、调用链、改动影响半径时。codegraph 可用时优先用其 codegraph_* 工具（search / context / trace / callers / callees / impact / explore），原则：精确到代码块，宁可多检索一次。',
    tools: ['codegraph_search', 'codegraph_context', 'codegraph_trace', 'codegraph_callers', 'codegraph_callees', 'codegraph_impact', 'codegraph_explore'],
    external: true,
  },
  session: {
    title: '会话绑定',
    when: '开始处理某个 spec 时先 attach，后续调用可省略 spec_dir。',
    tools: ['loom_attach_spec'],
  },
  meta: {
    title: '元工具（能力目录 / 遥测）',
    when: '查看 loom 能力目录、加载工具组、查询会话遥测数据时。',
    tools: ['loom_list_capabilities', 'loom_load_tool_group', 'loom_telemetry'],
  },
};

// ── 工具执行 ───────────────────────────────────────────────────────────────

export async function executeToolCall(toolName, args, sessionStore, sessionId, { fs } = {}) {
  const fsImpl = fs || new NodeFileSystem();
  const specDir = sessionStore.resolveSpecDir(sessionId, args.spec_dir);
  const projectRoot = sessionStore.resolveProjectRoot(sessionId, args.project_root);

  switch (toolName) {

    case 'loom_list_capabilities': {
      const root = args.project_root || projectRoot;
      const codegraphReady = existsSync(join(root, '.codegraph'));
      const groups = Object.entries(CAPABILITY_GROUPS)
        .filter(([key]) => key !== 'retrieval' || codegraphReady)
        .map(([key, g]) => ({
          group: key,
          title: g.title,
          when: g.when,
          tools: g.tools,
          external: Boolean(g.external),
        }));
      return {
        hint: 'Pick the group that matches the task, then call only those tools. For context files, prefer loom_get_context over reading whole files.',
        codegraph_available: codegraphReady,
        groups,
      };
    }

    case 'loom_get_context': {
      if (!args.doc) return { error: `Missing doc. One of: ${DOC_KEYS.join(', ')}` };
      const root = args.project_root || projectRoot;
      const idx = loadContextIndex(join(root, '.loom'), args.doc, fsImpl);
      if (!idx) return { error: `Context doc not found: ${args.doc}` };
      // 回退闸：显式 full 或全局开关 → 整篇原文（绕过分节，防前言丢失）
      if (args.full || process.env.LOOM_CONTEXT_FULL) return idx.full();

      // L0 目录路径
      if (!args.section) {
        const out = idx.outline();
        // 自动兜底：文档无任何 ## 节 → 目录为空，正文全在前言区会丢失 → 回全文
        if (out.section_count === 0) return { ...idx.full(), fallback: 'no-sections' };
        return out;
      }

      // L1 取节路径
      const section = idx.getSection(args.section);
      // 命中且有正文 → 正常分级返回（省 token）
      if (section && section.content && section.content.trim()) return section;
      // 文档根本无分节 → 没法匹配，回全文兜底
      if (idx.sections.length === 0) return { ...idx.full(), fallback: 'no-sections' };
      // 命中但正文为空 → 回全文兜底，避免空响应丢信息
      if (section) return { ...idx.full(), fallback: 'empty-section', requested_section: args.section };
      // 有节但没匹配上 = 大概率拼错节名 → 给目录廉价重试，不整篇 dump
      return {
        error: `Section "${args.section}" not found in ${args.doc}`,
        available_sections: idx.outline().sections.map(s => s.title),
      };
    }

    case 'loom_get_project_status': {
      const root = args.project_root || projectRoot;
      const allSpecs = scanAllSpecs(root, { fs: fsImpl });
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
      const engine = new PipelineEngine(projectRoot, safeResolveSpecDir(projectRoot, specDir), { fs: fsImpl });
      const ctx = engine.getStageContext();
      if (!ctx) return { error: 'Pipeline not initialized' };
      const currentStep = engine.getSteps().find(s => s.id === ctx.current_stage);
      ctx.constraints = {
        must_produce: currentStep?.outputs || [],
        must_not_skip: currentStep?.skill ? [currentStep.skill] : [],
        requires_files: currentStep?.requires || [],
      };
      ctx.forbidden_actions = [
        'Do not skip the current stage skill',
        'Do not advance without producing required outputs',
      ];
      return ctx;
    }

    case 'loom_select_pipeline': {
      if (!args.request) return { error: 'request is required' };
      const absSpec = specDir ? safeResolveSpecDir(projectRoot, specDir) : null;
      const selector = new PipelineSelector(projectRoot, absSpec, { fs: fsImpl });
      const result = await selector.select(args.request);

      if (!args.initialize) return result;

      if (!absSpec) return { error: 'spec_dir is required when initialize=true' };
      return await withSpecLock(absSpec, () => {
        const engine = new PipelineEngine(projectRoot, absSpec, { fs: fsImpl });
        const initResult = engine.initialize(null, { dynamicSteps: result.steps });
        return { ...result, initialized: true, state: initResult.state };
      }, fsImpl);
    }

    case 'loom_advance_pipeline': {
      if (!specDir) return { error: 'No spec_dir' };
      const abs = safeResolveSpecDir(projectRoot, specDir);
      return await withSpecLock(abs, () => new PipelineEngine(projectRoot, abs, { fs: fsImpl }).advance(), fsImpl);
    }

    case 'loom_approve_gate': {
      if (!specDir) return { error: 'No spec_dir' };
      const abs = safeResolveSpecDir(projectRoot, specDir);
      return await withSpecLock(abs, () => new PipelineEngine(projectRoot, abs, { fs: fsImpl }).approve(), fsImpl);
    }

    case 'loom_update_task_state': {
      if (!specDir) return { error: 'No spec_dir' };
      const abs = safeResolveSpecDir(projectRoot, specDir);
      const store = new PipelineStateStore(abs, { fs: fsImpl });
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
      const memStore = new MemoryStore(join(projectRoot, '.loom'), { fs: fsImpl });
      return memStore.list({ type: args.type, limit: args.limit || 10 });
    }

    case 'loom_add_memory': {
      const memStore = new MemoryStore(join(projectRoot, '.loom'), { fs: fsImpl });
      const entry = memStore.add(args.type, args.content, { context: args.context });
      return { ok: true, entry };
    }

    case 'loom_attach_spec': {
      sessionStore.attach(sessionId, args.spec_dir, args.project_root || projectRoot);
      return { ok: true, attached: args.spec_dir };
    }

    case 'loom_load_tool_group': {
      const group = args.group;
      if (!CAPABILITY_GROUPS[group]) return { error: `Unknown group: ${group}. Available: ${Object.keys(CAPABILITY_GROUPS).join(', ')}` };
      sessionStore.loadGroup(sessionId, group);
      const toolNames = CAPABILITY_GROUPS[group].tools.filter(t => TOOL_DEFINITIONS.some(td => td.name === t));
      return { ok: true, group, loaded_tools: toolNames };
    }

    case 'loom_get_skill_context': {
      const loader = new SkillLoader(SKILLS_DIR, { fs: fsImpl });

      // 无 skill 参数 → L0 全量摘要
      if (!args.skill) {
        const summaries = loader.listSummaries();
        return {
          level: 'L0',
          total_skills: summaries.length,
          total_tokens: summaries.reduce((sum, s) => sum + s.tokens, 0),
          hint: 'Call with skill name to get L1 full content, or skill + section for a single section.',
          skills: summaries,
        };
      }

      // 有 skill + section → L1 单节
      if (args.section) {
        const section = loader.getSkillSection(args.skill, args.section);
        if (!section) {
          const summary = loader.getSummary(args.skill);
          return {
            error: `Section "${args.section}" not found in skill "${args.skill}"`,
            available_sections: summary ? summary.sections : [],
          };
        }
        return { level: 'L1', ...section };
      }

      // 有 skill 无 section → L1 完整 skill
      const full = loader.getFullSkill(args.skill);
      if (!full) return { error: `Skill not found: ${args.skill}. Call without args to list all skills.` };
      return { level: 'L1', ...full };
    }

    case 'loom_telemetry': {
      return getSnapshot();
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
