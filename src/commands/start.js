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
import { join, relative } from 'node:path';

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

  // ─── 输出 ────────────────────────────────────────────────────────────────
  if (format === 'full') {
    printFull({ projectRoot, issues, activeSpecs, memorySummary, loomDir });
  } else {
    printPaste({ projectRoot, issues, activeSpecs, memorySummary });
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

function printPaste({ projectRoot, issues, activeSpecs, memorySummary }) {
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

  lines.push('');
  lines.push('请读取 .loom/workflow.yaml 了解流水线配置，');
  lines.push('读取 .loom/rules/constitution.md 了解项目约束。');
  lines.push('');

  console.log(lines.join('\n'));
}

function printFull({ projectRoot, issues, activeSpecs, memorySummary, loomDir }) {
  printPaste({ projectRoot, issues, activeSpecs, memorySummary });
  console.log('─── 详细路径 ───────────────────────────────────');
  console.log(`  .loom 目录:     ${loomDir}`);
  console.log(`  constitution:   ${join(loomDir, 'rules', 'constitution.md')}`);
  console.log(`  workflow:       ${join(loomDir, 'workflow.yaml')}`);
  console.log(`  memory:         ${join(loomDir, 'memory', 'MEMORY.md')}`);
  console.log('');
}
