/**
 * artifact-checker.js — 产物存在性与内容校验
 *
 * 每个流水线阶段进入前，检查前置产物是否齐全；
 * 阶段完成后，检查输出产物是否落地且无占位符。
 * 不执行代码，只做文件系统和文本扫描。
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// 占位符标记：大写形式，区分大小写，避免误伤正文 "todo list" 这类普通词
const PLACEHOLDER_MARKER_RE = /\b(TBD|TODO|FIXME|XXX)\b/;
// 明确的英文占位短语：大小写不敏感（已移除 HH:mm，正常文档会出现时间格式说明）
const PLACEHOLDER_PHRASE_RE = /\b(implement later|fill in details|placeholder text)\b/i;
const TEMPLATE_VAR_RE = /\{\{[A-Z_]+\}\}/; // 未渲染的模板变量 {{FOO}}

function hasPlaceholder(content) {
  return PLACEHOLDER_MARKER_RE.test(content)
    || PLACEHOLDER_PHRASE_RE.test(content)
    || TEMPLATE_VAR_RE.test(content);
}

// ── 阶段前置条件检查表 ─────────────────────────────────────────────────────
// 每个阶段需要哪些文件存在才能开始

const PRECONDITIONS = {
  planning: [
    { file: 'spec.md', desc: 'spec.md (brainstorming output)' }
  ],
  approved: [
    { file: 'spec.md', desc: 'spec.md' },
    { file: 'plan.md', desc: 'plan.md (planning output)' }
  ],
  'git-worktree': [
    { file: 'spec.md', desc: 'spec.md' },
    { file: 'plan.md', desc: 'plan.md' }
  ],
  executing: [
    { file: 'spec.md', desc: 'spec.md' },
    { file: 'plan.md', desc: 'plan.md' },
    { file: 'tasks', desc: 'tasks/ directory', isDir: true }
  ],
  verification: [
    { file: 'spec.md', desc: 'spec.md' },
    { file: 'test-report.md', desc: 'test-report.md (subagent output)' }
  ],
  synced: [
    { file: 'verify-report.md', desc: 'verify-report.md (verification output)' }
  ]
};

// ── 阶段产物定义 ────────────────────────────────────────────────────────────
// 每个阶段完成后应该产生哪些文件

const STAGE_OUTPUTS = {
  brainstorming: ['spec.md'],
  planning: ['plan.md'],
  executing: ['test-report.md'],
  verification: ['verify-report.md'],
  synced: []
};

// ── 核心函数 ───────────────────────────────────────────────────────────────

/**
 * 检查进入某阶段的前置条件
 * @returns {{ ok: boolean, missing: string[] }}
 */
export function checkPreconditions(specDir, stage) {
  const required = PRECONDITIONS[stage] || [];
  const missing = [];

  for (const req of required) {
    const path = join(specDir, req.file);
    if (!existsSync(path)) {
      missing.push(req.desc);
    }
  }

  return { ok: missing.length === 0, missing };
}

/**
 * 检查阶段完成后的产物是否落地
 * @returns {{ ok: boolean, missing: string[], withPlaceholders: string[] }}
 */
export function checkStageOutputs(specDir, stage) {
  const outputs = STAGE_OUTPUTS[stage] || [];
  const missing = [];
  const withPlaceholders = [];

  for (const file of outputs) {
    const path = join(specDir, file);
    if (!existsSync(path)) {
      missing.push(file);
      continue;
    }
    const content = readFileSync(path, 'utf-8');
    if (hasPlaceholder(content)) {
      withPlaceholders.push(file);
    }
  }

  return {
    ok: missing.length === 0 && withPlaceholders.length === 0,
    missing,
    withPlaceholders
  };
}

/**
 * 检测 spec 目录当前所处的流水线阶段（基于文件存在性推断）
 * 仅作为 pipeline.state.json 缺失时的 fallback。状态文件存在时以它为准。
 *
 * 不再依赖 progress.md 的文本匹配（progress.md 是自动生成的，
 * 任何 task 曾 executing 就含该词，导致阶段判断永久卡死）。
 * 改用 task-states/ 目录是否非空来判断是否已进入执行阶段。
 */
export function inferStageFromArtifacts(specDir) {
  const has = (f) => existsSync(join(specDir, f));

  if (has('verify-report.md')) return 'synced';
  if (has('test-report.md'))   return 'verification';

  // task-states 目录存在且非空 → subagent 已开工 → executing
  const taskStatesDir = join(specDir, 'task-states');
  if (existsSync(taskStatesDir)) {
    try {
      if (readdirSync(taskStatesDir).some(f => f.endsWith('.state.json'))) {
        return 'executing';
      }
    } catch {}
  }

  if (has('plan.md'))   return 'approved';
  if (has('spec.md'))   return 'planning';
  return 'brainstorming';
}

/**
 * 解析报告里的结构化裁定。
 * 优先读显式标记（任一行匹配 `verdict: PASS` / `**Verdict:** FAIL` / `结论：通过`），
 * 只认整行的裁定字段，不再扫全文关键词（避免 "确保不会 FAIL" 这类句子误判）。
 * @returns {'PASS'|'FAIL'|null} null 表示报告未给出明确裁定
 */
export function parseVerdict(content) {
  const lines = content.split('\n');
  for (const line of lines) {
    // 匹配：可选 markdown 强调/前缀 + verdict/结论 + 分隔符 + 值
    const m = line.match(/^[\s>*_#-]*(?:verdict|结论|裁定)\s*[:：]\s*\**\s*([A-Za-z一-龥]+)/i);
    if (m) {
      const v = m[1].toUpperCase();
      if (v === 'PASS' || v === '通过') return 'PASS';
      if (v === 'FAIL' || v === '失败' || v === '不通过' || v === 'BLOCKED') return 'FAIL';
    }
  }
  return null;
}

/**
 * 检查 test-report.md 是否通过。
 * 优先用结构化裁定；无显式裁定时回退到保守启发式（含 FAIL/失败 即判不通过）。
 */
export function isTestReportPassing(specDir) {
  const path = join(specDir, 'test-report.md');
  if (!existsSync(path)) return false;
  const content = readFileSync(path, 'utf-8');

  const verdict = parseVerdict(content);
  if (verdict) return verdict === 'PASS';

  // fallback：无显式裁定，保守判断
  const hasFail = /\bFAIL\b|失败|不通过/.test(content);
  const hasPass = /\bPASS\b|通过/.test(content);
  return hasPass && !hasFail;
}

/**
 * 检查 verify-report.md 是否通过。
 */
export function isVerifyReportPassing(specDir) {
  const path = join(specDir, 'verify-report.md');
  if (!existsSync(path)) return false;
  const content = readFileSync(path, 'utf-8');

  const verdict = parseVerdict(content);
  if (verdict) return verdict === 'PASS';

  const hasFail = /\bFAIL\b|失败|\bBLOCKER\b/.test(content);
  const hasPass = /\bPASS\b|通过|all checks passed/i.test(content);
  return hasPass && !hasFail;
}
