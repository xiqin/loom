/**
 * loom start — 跨工具通用会话初始化命令
 *
 * 功能：打印当前项目的 loom 状态，输出可直接粘贴到 AI 会话的上下文摘要。
 * 适用场景：Cursor / Copilot / Codex 等不支持 session-start hook 的工具，
 * 以及 Claude Code 用户希望手动触发初始化的场景。
 *
 * 使用方式：
 *   loom start                 # 在当前目录检测项目状态
 *   loom start --cwd <path>    # 指定项目根目录
 *   loom start --format paste  # 输出适合粘贴到 AI 的简洁格式（默认）
 *   loom start --format full   # 输出完整诊断信息
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContextIndex } from '../core/context-index.js';
import { SkillLoader } from '../core/skill-loader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = join(__dirname, '..', '..', 'skills');

const PROJECT_MARKERS = [
  'package.json', 'go.mod', 'pyproject.toml', 'Cargo.toml',
  'pom.xml', 'build.gradle', 'requirements.txt', 'Gemfile',
  'build.zig', 'Makefile',
];

function findProjectRoot(cwd) {
  let dir = cwd;
  for (let i = 0; i < 5; i++) {
    if (PROJECT_MARKERS.some(m => existsSync(join(dir, m)))) return dir;
    const parent = join(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function readFileSafe(path) {
  try { return readFileSync(path, 'utf-8'); } catch { return null; }
}

function detectCurrentPipelineStage(specsDir) {
  if (!existsSync(specsDir)) return null;
  const entries = readdirSync(specsDir, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .sort((a, b) => b.name.localeCompare(a.name)); // 最新在前

  const active = [];
  for (const entry of entries) {
    const dir = join(specsDir, entry.name);
    const spec = existsSync(join(dir, 'spec.md'));
    const plan = existsSync(join(dir, 'plan.md'));
    const progress = existsSync(join(dir, 'progress.md'));
    const testReport = existsSync(join(dir, 'test-report.md'));
    const verifyReport = existsSync(join(dir, 'verify-report.md'));

    let stage = 'brainstorming';
    if (verifyReport) stage = 'index-update';
    else if (testReport) stage = 'verification';
    else if (progress) stage = 'executing';
    else if (plan) stage = 'git-worktree / executing';
    else if (spec) stage = 'writing-plans';

    if (!verifyReport) { // 还没完成的才算"进行中"
      active.push({ name: entry.name, stage });
    }
  }
  return active;
}

function checkPlaceholders(constitutionPath) {
  const content = readFileSafe(constitutionPath);
  if (!content) return [];
  return [...new Set(content.match(/\{\{[A-Z_]+\}\}/g) || [])];
}

export default async function start(options) {
  const cwd = options.cwd || process.cwd();
  const format = options.format || 'paste';

  const projectRoot = findProjectRoot(cwd);
  if (!projectRoot) {
    console.log('\n  loom start: 未检测到项目根目录\n');
    return;
  }

  const loomDir = join(projectRoot, '.loom');
  const constitutionPath = join(loomDir, 'rules', 'constitution.md');
  const memoryPath = join(loomDir, 'memory', 'MEMORY.md');
  const workflowPath = join(loomDir, 'workflow.yaml');
  const specsDir = join(projectRoot, 'specs');

  // ─── 未初始化 ─────────────────────────────────────────────────────────────
  if (!existsSync(loomDir)) {
    console.log('\n  ⚠  项目未初始化 loom。');
    console.log('  请运行: /loom-init-project\n');
    return;
  }

  // ─── 收集信息 ─────────────────────────────────────────────────────────────
  const issues = [];

  const unrendered = checkPlaceholders(constitutionPath);
  if (unrendered.length > 0) {
    issues.push(`constitution.md 含未渲染占位符: ${unrendered.join(', ')}`);
  }
  if (!existsSync(workflowPath)) {
    issues.push('缺少 .loom/workflow.yaml');
  }

  const activeSpecs = detectCurrentPipelineStage(specsDir);
  const memoryContent = readFileSafe(memoryPath);
  const memorySummary = extractMemorySummary(memoryContent);

  // L0 渐进式披露：只输出宪章的"目录"（节标题），详情让 AI 按需用 loom_get_context 取
  const constitutionIdx = loadContextIndex(loomDir, 'constitution');
  const constitutionOutline = constitutionIdx
    ? constitutionIdx.outline().sections.map(s => s.title)
    : [];
  // 自动兜底：宪章存在但无任何 ## 节 → 目录会空，改提示整篇读，防丢正文
  const constitutionFullFallback = !!constitutionIdx && constitutionOutline.length === 0;

  // ─── 输出 ────────────────────────────────────────────────────────────────
  // Skill L0 摘要
  const skillLoader = new SkillLoader(SKILLS_DIR);
  const skillSummaries = skillLoader.listSummaries();

  if (format === 'full') {
    printFull({ projectRoot, issues, activeSpecs, memorySummary, constitutionOutline, constitutionFullFallback, loomDir, skillSummaries });
  } else {
    printPaste({ projectRoot, issues, activeSpecs, memorySummary, constitutionOutline, constitutionFullFallback, skillSummaries });
  }
}

function extractMemorySummary(content) {
  if (!content) return [];
  // 提取 📌 摘要 区块的前 5 条
  const match = content.match(/📌\s*摘要[\s\S]*?(?=\n##|\n🏗|\n⚠️|\n👤|\n📦|$)/);
  if (!match) return [];
  const lines = match[0].split('\n')
    .filter(l => l.match(/^\d{4}-\d{2}-\d{2}\s*\|/))
    .slice(0, 5);
  return lines;
}

function printPaste({ projectRoot, issues, activeSpecs, memorySummary, constitutionOutline = [], constitutionFullFallback = false, skillSummaries = [] }) {
  const lines = [];
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push(' loom 项目状态（粘贴到 AI 会话）');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push(`项目根目录: ${projectRoot}`);

  if (issues.length > 0) {
    lines.push('');
    lines.push('⚠ 配置问题（需修复）:');
    for (const issue of issues) lines.push(`  · ${issue}`);
  }

  if (activeSpecs && activeSpecs.length > 0) {
    lines.push('');
    lines.push('📋 进行中的开发任务:');
    for (const s of activeSpecs) {
      lines.push(`  · ${s.name}  →  当前阶段: ${s.stage}`);
    }
  } else {
    lines.push('');
    lines.push('📋 当前无进行中的开发任务');
  }

  if (memorySummary.length > 0) {
    lines.push('');
    lines.push('📌 最近记忆摘要:');
    for (const m of memorySummary) lines.push(`  ${m.trim()}`);
  }

  if (process.env.LOOM_CONTEXT_FULL) {
    // 回退闸：判定分节披露不可靠时，指示整篇读，绕过 L0/L1
    lines.push('');
    lines.push('📖 宪章: 请整篇读 .loom/rules/constitution.md（LOOM_CONTEXT_FULL 已开）');
  } else if (constitutionFullFallback) {
    // 自动兜底：宪章无 ## 分节，目录为空，整篇读避免丢正文
    lines.push('');
    lines.push('📖 宪章: 无分节结构，请整篇读 .loom/rules/constitution.md');
  } else if (constitutionOutline.length > 0) {
    lines.push('');
    lines.push('📖 宪章目录（按需取，勿整篇读）:');
    for (const t of constitutionOutline) lines.push(`  · ${t}`);
  }

  // Skill L0 摘要
  if (skillSummaries.length > 0) {
    lines.push('');
    lines.push('🔧 可用 Skills（摘要，勿全量加载）:');
    for (const s of skillSummaries) {
      const label = s.description || s.name;
      lines.push(`  · ${s.name} — ${label}`);
    }
    lines.push('  获取完整内容: loom_get_skill_context(skill="技能名")');
  }

  lines.push('');
  lines.push('渐进式披露：用 MCP 工具 loom_get_context 按节取上下文，');
  lines.push('  · loom_get_context(doc) → 看目录   · loom_get_context(doc, section) → 取该节');
  lines.push('  doc 可选: constitution / project-structure / index / memory / workflow');
  lines.push('不支持 MCP 时再按需读 .loom/rules/constitution.md、.loom/workflow.yaml。');
  lines.push('');

  console.log(lines.join('\n'));
}

function printFull({ projectRoot, issues, activeSpecs, memorySummary, constitutionOutline, loomDir, skillSummaries }) {
  printPaste({ projectRoot, issues, activeSpecs, memorySummary, constitutionOutline, skillSummaries });
  console.log('─── 详细路径 ───────────────────────────────────');
  console.log(`  .loom 目录:     ${loomDir}`);
  console.log(`  constitution:   ${join(loomDir, 'rules', 'constitution.md')}`);
  console.log(`  workflow:       ${join(loomDir, 'workflow.yaml')}`);
  console.log(`  memory:         ${join(loomDir, 'memory', 'MEMORY.md')}`);
  console.log('');
}
