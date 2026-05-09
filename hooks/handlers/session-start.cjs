const { existsSync } = require('node:fs');
const { join } = require('node:path');

const PROJECT_MARKERS = [
  'package.json', 'go.mod', 'pyproject.toml', 'Cargo.toml',
  'pom.xml', 'build.gradle', 'requirements.txt', 'Gemfile',
  'build.zig', 'Makefile',
];

function isProjectRoot(cwd) {
  return PROJECT_MARKERS.some(f => existsSync(join(cwd, f)));
}

function run() {
  const cwd = process.cwd();

  if (!isProjectRoot(cwd)) {
    console.debug('[rss:session-start] No project root detected, skipping');
    return;
  }

  const constitution = join(cwd, '.rss', 'memory', 'constitution.md');
  if (!existsSync(constitution)) {
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(' rss: 项目未初始化');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log(' 建议运行 /rss-init-project 扫描项目并生成配置');
    console.log('');
  }
}

module.exports = { run };
