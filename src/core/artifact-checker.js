/**
 * artifact-checker.js — 产物存在性与内容校验
 *
 * 每个流水线阶段进入前，检查前置产物是否齐全；
 * 阶段完成后，检查输出产物是否落地且无占位符。
 * 不执行代码，只做文件系统和文本扫描。
 */

import { NodeFileSystem } from './fs-interface.js';
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


// ── 核心函数 ───────────────────────────────────────────────────────────────

/**
 * 检查进入某阶段的前置条件
 * @param {string[]} requires - 元素尾 '/' 表示目录检查
 * @returns {{ ok: boolean, missing: string[] }}
 */
export function checkPreconditions(specDir, requires, fs = new NodeFileSystem()) {
  const missing = [];
  for (const req of (requires || [])) {
    const isDir = req.endsWith('/');
    const rel  = isDir ? req.slice(0, -1) : req;
    if (!fs.existsSync(join(specDir, rel))) missing.push(req);
  }
  return { ok: missing.length === 0, missing };
}

/**
 * 检查阶段完成后的产物是否落地且无占位符
 * @param {string[]} outputs
 * @returns {{ ok: boolean, missing: string[], withPlaceholders: string[] }}
 */
export function checkStageOutputs(specDir, outputs, fs = new NodeFileSystem()) {
  const missing = [];
  const withPlaceholders = [];

  for (const file of (outputs || [])) {
    const path = join(specDir, file);
    if (!fs.existsSync(path)) {
      missing.push(file);
      continue;
    }
    const content = fs.readFileSync(path, 'utf-8');
    if (hasPlaceholder(content)) withPlaceholders.push(file);
  }

  return {
    ok: missing.length === 0 && withPlaceholders.length === 0,
    missing,
    withPlaceholders
  };
}

/**
 * 通用 verdict 检查：读指定报告文件，verdict===PASS 则通过
 * @param {string} filename - 相对 specDir 的文件名
 */
export function isReportPassing(specDir, filename, fs = new NodeFileSystem()) {
  const path = join(specDir, filename);
  if (!fs.existsSync(path)) return false;
  const content = fs.readFileSync(path, 'utf-8');
  const verdict = parseVerdict(content);
  if (verdict) return verdict === 'PASS';
  // fallback 启发式（无显式裁定时保守判断）
  const hasFail = /\bFAIL\b|失败|不通过|\bBLOCKER\b/.test(content);
  const hasPass = /\bPASS\b|通过|all checks passed/i.test(content);
  return hasPass && !hasFail;
}

/**
 * 检测 spec 目录当前所处的流水线阶段（基于文件存在性推断）
 * 仅作为 pipeline.state.json 缺失时的 fallback。状态文件存在时以它为准。
 *
 * 不再依赖 progress.md 的文本匹配（progress.md 是自动生成的，
 * 任何 task 曾 executing 就含该词，导致阶段判断永久卡死）。
 * 改用 task-states/ 目录是否非空来判断是否已进入执行阶段。
 */
export function inferStageFromArtifacts(specDir, fs = new NodeFileSystem()) {
  const has = (f) => fs.existsSync(join(specDir, f));

  if (has('verify-report.md')) return 'synced';
  if (has('test-report.md'))   return 'verification';

  // task-states 目录存在且非空 → subagent 已开工 → executing
  const taskStatesDir = join(specDir, 'task-states');
  if (fs.existsSync(taskStatesDir)) {
    try {
      if (fs.readdirSync(taskStatesDir).some(f => f.endsWith('.state.json'))) {
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
      if (v === 'PARTIAL' || v === '部分') return 'PARTIAL';
    }
  }
  return null;
}

/** @deprecated 使用 isReportPassing(specDir, 'test-report.md') */
export function isTestReportPassing(specDir, fs = new NodeFileSystem()) {
  return isReportPassing(specDir, 'test-report.md', fs);
}

/** @deprecated 使用 isReportPassing(specDir, 'verify-report.md') */
export function isVerifyReportPassing(specDir, fs = new NodeFileSystem()) {
  return isReportPassing(specDir, 'verify-report.md', fs);
}

/**
 * 检查 .md 产物文件是否包含必需的 section 标题
 * @param {string} specDir
 * @param {string} filename - 相对 specDir 的文件名
 * @param {string[]} requiredSections - 必需的 section 标题（如 ['## Approach', '## Tasks']）
 * @returns {{ ok: boolean, missing: string[] }}
 */
export function checkRequiredSections(specDir, filename, requiredSections, fs = new NodeFileSystem()) {
  const path = join(specDir, filename);
  if (!fs.existsSync(path)) return { ok: false, missing: [filename] };
  const content = fs.readFileSync(path, 'utf-8');
  const missing = [];
  for (const section of (requiredSections || [])) {
    if (!content.includes(section)) missing.push(section);
  }
  return { ok: missing.length === 0, missing };
}
