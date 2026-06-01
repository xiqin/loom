const { checkProject } = require('./health-check.cjs');

function run() {
  const cwd = process.cwd();
  const result = checkProject(cwd);

  // ── 不在项目根 ────────────────────────────────────────────
  if (result.state === 'no-project') {
    console.debug('[loom:session-start] No project root detected, skipping');
    return;
  }

  // ── 未初始化 ──────────────────────────────────────────────
  if (result.state === 'uninitialized') {
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(' loom: 项目未初始化');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log(' 建议运行 /loom-init-project 扫描项目并生成配置');
    console.log('');
    return;
  }

  // ── 状态健康，静默通过（不打扰用户）──────────────────────
  if (result.state === 'healthy') return;

  // ── 已初始化但有问题，输出检查结果 ────────────────────────
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' loom: 项目状态检查');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (result.issues.length > 0) {
    console.log('');
    console.log(' ⚠ 需要修复（影响流水线正常运行）：');
    for (const issue of result.issues) {
      console.log(`   · ${issue}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log('');
    console.log(' ℹ 提示：');
    for (const w of result.warnings) {
      console.log(`   · ${w}`);
    }
  }

  console.log('');
}

module.exports = { run };
