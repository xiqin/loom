const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const PROJECT_MARKERS = [
  'package.json', 'go.mod', 'pyproject.toml', 'Cargo.toml',
  'pom.xml', 'build.gradle', 'requirements.txt', 'Gemfile',
  'build.zig', 'Makefile',
];

function isProjectRoot(cwd) {
  return PROJECT_MARKERS.some(f => existsSync(join(cwd, f)));
}

// 检查 constitution.md 中是否有未渲染的占位符
function checkConstitutionPlaceholders(loomDir) {
  const constitutionPath = join(loomDir, 'rules', 'constitution.md');
  if (!existsSync(constitutionPath)) return [];
  const content = readFileSync(constitutionPath, 'utf-8');
  const placeholders = content.match(/\{\{[A-Z_]+\}\}/g) || [];
  return [...new Set(placeholders)];
}

// 检查 workflow.yaml 是否存在
function checkWorkflow(loomDir) {
  return existsSync(join(loomDir, 'workflow.yaml'));
}

// 检查当前 specs/ 下是否有阶段产物不一致的情况（spec 有但 plan 没有）
function checkSpecsPlanConsistency(cwd) {
  const specsDir = join(cwd, 'specs');
  if (!existsSync(specsDir)) return [];
  const fs = require('node:fs');
  const warnings = [];
  try {
    const entries = fs.readdirSync(specsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const specPath = join(specsDir, entry.name, 'spec.md');
      const planPath = join(specsDir, entry.name, 'plan.md');
      if (existsSync(specPath) && !existsSync(planPath)) {
        warnings.push(`specs/${entry.name}: spec.md 存在但缺少 plan.md（brainstorming 完成，planning 未开始？）`);
      }
    }
  } catch {}
  return warnings;
}

function run() {
  const cwd = process.cwd();

  if (!isProjectRoot(cwd)) {
    console.debug('[loom:session-start] No project root detected, skipping');
    return;
  }

  const loomDir = join(cwd, '.loom');
  const constitutionPath = join(loomDir, 'memory', 'constitution.md');

  // ── 未初始化 ──────────────────────────────────────────────
  if (!existsSync(constitutionPath)) {
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(' loom: 项目未初始化');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log(' 建议运行 /loom-init-project 扫描项目并生成配置');
    console.log('');
    return;
  }

  // ── 已初始化，做主动健康检查 ──────────────────────────────
  const issues = [];
  const warnings = [];

  // 检查1：constitution.md 未渲染占位符
  const unrendered = checkConstitutionPlaceholders(loomDir);
  if (unrendered.length > 0) {
    issues.push(`constitution.md 存在未渲染占位符: ${unrendered.join(', ')}`);
  }

  // 检查2：workflow.yaml 缺失
  if (!checkWorkflow(loomDir)) {
    issues.push('缺少 .loom/workflow.yaml（流水线无法自动流转）');
  }

  // 检查3：specs 目录一致性检查
  const specWarnings = checkSpecsPlanConsistency(cwd);
  warnings.push(...specWarnings);

  // ── 输出结果 ────────────────────────────────────────────────
  if (issues.length === 0 && warnings.length === 0) {
    // 项目状态健康，静默通过（不打扰用户）
    return;
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' loom: 项目状态检查');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (issues.length > 0) {
    console.log('');
    console.log(' ⚠ 需要修复（影响流水线正常运行）：');
    for (const issue of issues) {
      console.log(`   · ${issue}`);
    }
  }

  if (warnings.length > 0) {
    console.log('');
    console.log(' ℹ 提示：');
    for (const w of warnings) {
      console.log(`   · ${w}`);
    }
  }

  console.log('');
}

module.exports = { run };
