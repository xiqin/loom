// 共享的 loom 项目健康检查逻辑。
// 被 Claude Code 的 session-start 钩子和 OpenCode 的 event 钩子共用，
// 避免两端各写一份检查规则导致行为漂移。

const { existsSync, readFileSync, readdirSync } = require('node:fs');
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

// 检查 specs/ 下阶段产物是否一致（spec 有但 plan 缺）
function checkSpecsPlanConsistency(cwd) {
  const specsDir = join(cwd, 'specs');
  if (!existsSync(specsDir)) return [];
  const warnings = [];
  try {
    const entries = readdirSync(specsDir, { withFileTypes: true });
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

/**
 * 对项目目录做健康检查，返回结构化结果（不打印）。
 * @param {string} cwd 项目根目录
 * @returns {{ state: 'no-project'|'uninitialized'|'healthy'|'issues', issues: string[], warnings: string[] }}
 */
function checkProject(cwd) {
  if (!isProjectRoot(cwd)) {
    return { state: 'no-project', issues: [], warnings: [] };
  }

  const loomDir = join(cwd, '.loom');
  const constitutionPath = join(loomDir, 'memory', 'constitution.md');
  if (!existsSync(constitutionPath)) {
    return { state: 'uninitialized', issues: [], warnings: [] };
  }

  const issues = [];
  const warnings = [];

  const unrendered = checkConstitutionPlaceholders(loomDir);
  if (unrendered.length > 0) {
    issues.push(`constitution.md 存在未渲染占位符: ${unrendered.join(', ')}`);
  }

  if (!checkWorkflow(loomDir)) {
    issues.push('缺少 .loom/workflow.yaml（流水线无法自动流转）');
  }

  warnings.push(...checkSpecsPlanConsistency(cwd));

  return {
    state: issues.length > 0 || warnings.length > 0 ? 'issues' : 'healthy',
    issues,
    warnings,
  };
}

/**
 * 把检查结果格式化成文本行（供需要紧凑展示的渠道，如 OpenCode toast）。
 * healthy / no-project 返回空数组（不打扰用户）。
 * @param {ReturnType<typeof checkProject>} result
 * @returns {string[]}
 */
function formatReport(result) {
  if (result.state === 'no-project' || result.state === 'healthy') return [];

  if (result.state === 'uninitialized') {
    return ['loom: 项目未初始化', '建议运行 /loom-init-project 扫描项目并生成配置'];
  }

  const lines = ['loom: 项目状态检查'];
  if (result.issues.length > 0) {
    lines.push('⚠ 需要修复（影响流水线正常运行）：');
    for (const issue of result.issues) lines.push(`· ${issue}`);
  }
  if (result.warnings.length > 0) {
    lines.push('ℹ 提示：');
    for (const w of result.warnings) lines.push(`· ${w}`);
  }
  return lines;
}

module.exports = {
  PROJECT_MARKERS,
  isProjectRoot,
  checkProject,
  formatReport,
};
