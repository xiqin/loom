#!/usr/bin/env node
/**
 * generate-incremental.mjs — Incremental wrapper for all generate scripts
 *
 * Skips a script if none of its declared input files have changed since last run.
 * Cache stored at: scripts/.generate-cache.json
 *
 * Usage:
 *   node scripts/generate-incremental.mjs          # incremental (default)
 *   node scripts/generate-incremental.mjs --force  # force regenerate all
 *   node scripts/generate-incremental.mjs --check  # exit 1 if any output is stale
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CACHE_PATH = join(__dirname, '.generate-cache.json');

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const CHECK = args.includes('--check');

// ── 脚本配置：每个脚本声明它的输入文件 ──────────────────────────────────
// inputs 变化时重新运行该脚本；未声明的文件变化不触发重新运行
const SCRIPTS = [
  {
    name: 'generate-tooling',
    cmd: 'node scripts/generate-tooling.mjs',
    inputs: [
      'config/tools.schema.json',
      'scripts/generate-tooling.mjs',
    ],
  },
  {
    name: 'generate-plugin-meta',
    cmd: 'node scripts/generate-plugin-meta.mjs',
    inputs: [
      'config/tools.schema.json',
      'scripts/generate-plugin-meta.mjs',
    ],
  },
  {
    name: 'generate-skills-catalog',
    cmd: 'node scripts/generate-skills-catalog.mjs',
    inputs: [
      'skills/',
      'scripts/generate-skills-catalog.mjs',
    ],
  },
  {
    name: 'generate-model-selection',
    cmd: 'node scripts/generate-model-selection.mjs',
    inputs: [
      'config/model-selection.md',
      'scripts/generate-model-selection.mjs',
    ],
  },
  {
    name: 'generate-shared-rules',
    cmd: 'node scripts/generate-shared-rules.mjs',
    inputs: [
      'config/shared-rules.md',
      'scripts/generate-shared-rules.mjs',
    ],
  },
  {
    name: 'generate-review-summary',
    cmd: 'node scripts/generate-review-summary.mjs',
    inputs: [
      'config/review-summary.md',
      'scripts/generate-review-summary.mjs',
    ],
  },
];

// ── 工具函数 ─────────────────────────────────────────────────────────────

/** 计算单个文件或目录（递归）的 SHA-256 哈希 */
function hashPath(relPath) {
  const abs = join(ROOT, relPath);
  if (!existsSync(abs)) return 'missing';

  // 目录：用 git ls-files 获取所有跟踪文件列表，再哈希内容
  // 回退：直接读取目录下所有文件（未初始化 git 时）
  try {
    const files = execSync(`git -C "${ROOT}" ls-files -- "${abs}"`, { encoding: 'utf-8' })
      .trim()
      .split('\n')
      .filter(Boolean)
      .sort();

    if (files.length === 0) return 'empty';

    const h = createHash('sha256');
    for (const f of files) {
      h.update(f);
      h.update(readFileSync(join(ROOT, f)));
    }
    return h.digest('hex');
  } catch {
    // 非 git 环境，直接哈希单文件
    return createHash('sha256').update(readFileSync(abs)).digest('hex').slice(0, 16);
  }
}

/** 计算一个脚本所有 inputs 的联合哈希 */
function computeHash(inputs) {
  const h = createHash('sha256');
  for (const p of inputs) {
    h.update(p);
    h.update(hashPath(p));
  }
  return h.digest('hex');
}

// ── 读取缓存 ─────────────────────────────────────────────────────────────
let cache = {};
if (existsSync(CACHE_PATH)) {
  try {
    cache = JSON.parse(readFileSync(CACHE_PATH, 'utf-8'));
  } catch {
    cache = {};
  }
}

// ── 主循环 ───────────────────────────────────────────────────────────────
let staleCount = 0;
let skippedCount = 0;
let ranCount = 0;
const staleNames = [];

for (const script of SCRIPTS) {
  const currentHash = computeHash(script.inputs);
  const cachedHash = cache[script.name];
  const isStale = FORCE || currentHash !== cachedHash;

  if (CHECK) {
    console.log(`  ▶ ${script.name} — checking outputs...`);
    try {
      execSync(`${script.cmd} --check`, {
        cwd: ROOT,
        stdio: 'inherit',
        env: { ...process.env, LOOM_GENERATE_CHECK: '1' },
      });
      skippedCount++;
    } catch {
      staleCount++;
      staleNames.push(script.name);
    }
    continue;
  }

  if (!isStale) {
    console.log(`  · ${script.name} — inputs unchanged, skipped`);
    skippedCount++;
    continue;
  }

  staleCount++;
  staleNames.push(script.name);

  console.log(`  ▶ ${script.name} — running...`);
  try {
    execSync(script.cmd, { cwd: ROOT, stdio: 'inherit' });
    cache[script.name] = currentHash;
    ranCount++;
  } catch (err) {
    console.error(`  ✘ ${script.name} — FAILED`);
    // 不更新缓存，下次强制重跑
    process.exit(1);
  }
}

// ── 保存缓存 ─────────────────────────────────────────────────────────────
if (!CHECK) {
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2) + '\n', 'utf-8');
}

// ── 汇总输出 ─────────────────────────────────────────────────────────────
console.log('');
if (CHECK) {
  if (staleCount > 0) {
    console.error(`✘ ${staleCount} script(s) have stale outputs: ${staleNames.join(', ')}`);
    console.error('  Run: node scripts/generate-incremental.mjs');
    process.exit(1);
  } else {
    console.log(`✔ All generate outputs are up to date (${skippedCount} scripts checked)`);
  }
} else {
  if (ranCount > 0) {
    console.log(`✔ Ran ${ranCount} script(s), skipped ${skippedCount} (inputs unchanged)`);
  } else {
    console.log(`✔ All outputs up to date — nothing to regenerate`);
  }
}
