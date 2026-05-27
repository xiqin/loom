/**
 * artifact-checker.js — 产物存在性与内容校验
 *
 * 每个流水线阶段进入前，检查前置产物是否齐全；
 * 阶段完成后，检查输出产物是否落地且无占位符。
 * 不执行代码，只做文件系统和文本扫描。
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PLACEHOLDER_RE = /\b(TBD|TODO|implement later|fill in details|HH:mm)\b/i;
const TEMPLATE_VAR_RE = /\{\{[A-Z_]+\}\}/;

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
    if (PLACEHOLDER_RE.test(content) || TEMPLATE_VAR_RE.test(content)) {
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
 * 用于 loom status 和 session-start hook
 */
export function inferStageFromArtifacts(specDir) {
  const has = (f) => existsSync(join(specDir, f));

  if (has('verify-report.md')) return 'synced';
  if (has('test-report.md'))   return 'verification';
  if (has('progress.md') && has('plan.md')) {
    // 检查 progress.md 里是否有 executing 标志
    try {
      const p = readFileSync(join(specDir, 'progress.md'), 'utf-8');
      if (/executing/i.test(p)) return 'executing';
    } catch {}
    return 'git-worktree';
  }
  if (has('plan.md'))   return 'approved';
  if (has('spec.md'))   return 'planning';
  return 'brainstorming';
}

/**
 * 检查 test-report.md 是否包含 PASS 结论
 */
export function isTestReportPassing(specDir) {
  const path = join(specDir, 'test-report.md');
  if (!existsSync(path)) return false;
  const content = readFileSync(path, 'utf-8');
  const hasFail = /\bFAIL\b|失败|不通过/i.test(content);
  const hasPass = /\bPASS\b|通过/i.test(content);
  return hasPass && !hasFail;
}

/**
 * 检查 verify-report.md 是否包含 PASS 结论
 */
export function isVerifyReportPassing(specDir) {
  const path = join(specDir, 'verify-report.md');
  if (!existsSync(path)) return false;
  const content = readFileSync(path, 'utf-8');
  const hasFail = /\bFAIL\b|失败|BLOCKER/i.test(content);
  const hasPass = /\bPASS\b|通过|all checks passed/i.test(content);
  return hasPass && !hasFail;
}
