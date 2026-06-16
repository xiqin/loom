/**
 * loom index — codegraph 索引同步入口
 *
 * 只在 codegraph 可用时同步图索引；未启用 codegraph 的项目不再生成
 *
 * 使用方式：
 *   loom index               # 同步 codegraph 索引；无 codegraph 时跳过
 *   loom index --check       # 检查 codegraph 状态；无 codegraph 时跳过
 *   loom index --cwd <path>  # 指定项目根目录
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// ─── codegraph 委派 ──────────────────────────────────────────────────────────
//
// codegraph（https://github.com/colbymchenry/codegraph）是外部独立工具：
// tree-sitter AST → SQLite 图，零配置，存于项目内 .codegraph/。
// 可用时它即索引后端，loom index 委派给它；
// 不可用时直接跳过索引更新。

/** 检测项目是否启用 codegraph：已建图（.codegraph/）或 CLI 在 PATH。 */
function codegraphAvailable(root) {
  if (existsSync(join(root, '.codegraph'))) return true;
  try {
    const r = spawnSync('codegraph', ['--version'], { stdio: 'ignore', shell: process.platform === 'win32', windowsHide: true });
    return r.status === 0;
  } catch {
    return false;
  }
}

/** 委派给 codegraph。生成模式 → sync；--check → status 退出码。返回退出码。 */
function delegateToCodegraph(root, checkOnly) {
  const args = checkOnly ? ['status'] : ['sync', root];
  const label = checkOnly ? 'codegraph status' : 'codegraph sync';
  console.log(`\n  loom index → ${label} (codegraph backend)\n`);
  const r = spawnSync('codegraph', args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    windowsHide: true,
  });
  return r.status ?? 0;
}

// ─── 主命令 ─────────────────────────────────────────────────────────────────

export default async function indexCommand(options) {
  const root = options.cwd || process.cwd();
  const checkOnly = options.check || false;

  if (options.codegraph !== false && codegraphAvailable(root)) {
    process.exitCode = delegateToCodegraph(root, checkOnly);
    return;
  }

  console.log('\n  loom index: codegraph not available; index update skipped.\n');
  console.log('  Install/initialize codegraph to enable symbol and impact queries.');
  console.log('');
}
