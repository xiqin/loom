/**
 * loom index — 代码驱动的工程索引生成器
 *
 * 把"AI 自觉更新索引"变成"代码扫描生成 + AI 审查确认"。
 * 静态分析不执行代码，只做文本/语法层面的扫描，零运行时依赖。
 *
 * 使用方式：
 *   loom index               # 扫描当前目录并更新索引
 *   loom index --check       # 只检查索引是否过期，不更新（用于 pre-commit / CI）
 *   loom index --cwd <path>  # 指定项目根目录
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, relative, extname, basename } from 'node:path';
import { spawnSync } from 'node:child_process';

// ─── codegraph 委派 ──────────────────────────────────────────────────────────
//
// codegraph（https://github.com/colbymchenry/codegraph）是外部独立工具：
// tree-sitter AST → SQLite 图，零配置，存于项目内 .codegraph/。
// 可用时它即索引后端，loom index 委派给它，不再生成 engineering-index.md；
// 不可用时降级为本文件的正则静态扫描器。

/** 检测项目是否启用 codegraph：已建图（.codegraph/）或 CLI 在 PATH。 */
function codegraphAvailable(root) {
  if (existsSync(join(root, '.codegraph'))) return true;
  try {
    const r = spawnSync('codegraph', ['--version'], { stdio: 'ignore', shell: process.platform === 'win32' });
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
  });
  return r.status ?? 0;
}

// ─── 静态扫描规则 ──────────────────────────────────────────────────────────

const ROUTE_PATTERNS = [
  // Express/Koa/Fastify (JS/TS)
  { re: /(?:router|app)\.(get|post|put|delete|patch|options|head)\(\s*['"`]([^'"`]+)['"`]/g, lang: 'js' },
  // Gin/Echo/Fiber (Go)
  { re: /\.(GET|POST|PUT|DELETE|PATCH)\(\s*"([^"]+)"/g, lang: 'go' },
  // Flask/FastAPI (Python)
  { re: /@(?:app|router|blueprint)\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]\)/g, lang: 'py' },
  // Rails (Ruby)
  { re: /\b(?:get|post|put|delete|patch)\s+['"]([^'"]+)['"]/g, lang: 'rb' },
];

const EXPORT_PATTERNS = [
  // JS/TS named exports
  { re: /^export\s+(?:async\s+)?(?:function|class|const|let|var)\s+(\w+)/gm, lang: 'js' },
  // Go exported functions/types
  { re: /^func\s+([A-Z]\w*)\s*[(\[]/gm, lang: 'go' },
  { re: /^type\s+([A-Z]\w*)\s+(?:struct|interface)/gm, lang: 'go' },
  // Python public functions/classes
  { re: /^(?:def|class)\s+([A-Z]\w*|[a-z]\w*(?<!_))\s*[:(]/gm, lang: 'py' },
];

const CONTROLLER_DIRS = ['controllers', 'controller', 'handlers', 'handler', 'api', 'routes'];
const SERVICE_DIRS = ['services', 'service', 'usecases', 'usecase', 'domain'];
const MODEL_DIRS = ['models', 'model', 'entities', 'entity', 'schema', 'schemas'];
const REPO_DIRS = ['repositories', 'repository', 'repo', 'dao', 'store'];

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.cache', 'vendor',
  '__pycache__', '.venv', 'venv', 'coverage', '.tox',
]);

// ─── 文件扫描 ───────────────────────────────────────────────────────────────

function walkFiles(dir, extensions, maxDepth = 6, depth = 0) {
  if (depth > maxDepth || !existsSync(dir)) return [];
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(full, extensions, maxDepth, depth + 1));
    } else if (entry.isFile() && extensions.includes(extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

function detectLanguage(root) {
  if (existsSync(join(root, 'go.mod'))) return 'go';
  if (existsSync(join(root, 'pyproject.toml')) || existsSync(join(root, 'requirements.txt'))) return 'py';
  if (existsSync(join(root, 'Gemfile'))) return 'rb';
  if (existsSync(join(root, 'Cargo.toml'))) return 'rs';
  if (existsSync(join(root, 'package.json'))) return 'js';
  return 'unknown';
}

function langExtensions(lang) {
  const map = {
    go: ['.go'],
    py: ['.py'],
    rb: ['.rb'],
    rs: ['.rs'],
    js: ['.js', '.ts', '.mjs', '.cjs', '.jsx', '.tsx'],
    unknown: ['.js', '.ts', '.go', '.py', '.rb'],
  };
  return map[lang] || map.unknown;
}

function extractRoutes(content, lang) {
  const routes = [];
  for (const { re, lang: l } of ROUTE_PATTERNS) {
    if (l !== lang && lang !== 'unknown') continue;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content)) !== null) {
      routes.push({ method: m[1].toUpperCase(), path: m[2] || m[1] });
    }
  }
  return routes;
}

function extractExports(content, lang) {
  const exports = [];
  for (const { re, lang: l } of EXPORT_PATTERNS) {
    if (l !== lang && lang !== 'unknown') continue;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content)) !== null) {
      exports.push(m[1]);
    }
  }
  return exports;
}

function classifyFile(relPath) {
  const lower = relPath.toLowerCase();
  for (const d of CONTROLLER_DIRS) if (lower.includes(`/${d}/`) || lower.includes(`\\${d}\\`)) return 'controller';
  for (const d of SERVICE_DIRS) if (lower.includes(`/${d}/`) || lower.includes(`\\${d}\\`)) return 'service';
  for (const d of MODEL_DIRS) if (lower.includes(`/${d}/`) || lower.includes(`\\${d}\\`)) return 'model';
  for (const d of REPO_DIRS) if (lower.includes(`/${d}/`) || lower.includes(`\\${d}\\`)) return 'repository';
  return 'other';
}

// ─── 索引生成 ───────────────────────────────────────────────────────────────

function buildIndex(root) {
  const lang = detectLanguage(root);
  const exts = langExtensions(lang);
  const files = walkFiles(root, exts);

  const routes = [];
  const byKind = { controller: [], service: [], model: [], repository: [] };

  for (const file of files) {
    const rel = relative(root, file);
    const content = readFileSync(file, 'utf-8');
    const kind = classifyFile(rel);
    const exports = extractExports(content, lang);
    const fileRoutes = extractRoutes(content, lang);

    if (fileRoutes.length > 0) {
      routes.push(...fileRoutes.map(r => ({ ...r, file: rel })));
    }

    if (kind !== 'other' && exports.length > 0) {
      byKind[kind].push({ file: rel, exports });
    }
  }

  return { lang, routes, byKind, scanned: files.length };
}

function renderMarkdown(root, index, timestamp) {
  const lines = [];
  lines.push(`# Engineering Index`);
  lines.push('');
  lines.push(`> Generated by \`loom index\` on ${timestamp}. Do not edit manually — run \`loom index\` to regenerate.`);
  lines.push(`> Language: ${index.lang} | Files scanned: ${index.scanned}`);
  lines.push('');

  // Routes
  lines.push('## Routes');
  lines.push('');
  if (index.routes.length === 0) {
    lines.push('_No routes detected. Add routes using standard framework patterns._');
  } else {
    lines.push('| Method | Path | File |');
    lines.push('|--------|------|------|');
    for (const r of index.routes) {
      lines.push(`| \`${r.method}\` | \`${r.path}\` | \`${r.file}\` |`);
    }
  }
  lines.push('');

  // Controllers
  lines.push('## Controllers');
  lines.push('');
  renderKind(lines, index.byKind.controller);

  // Services
  lines.push('## Services');
  lines.push('');
  renderKind(lines, index.byKind.service);

  // Models
  lines.push('## Models');
  lines.push('');
  renderKind(lines, index.byKind.model);

  // Repositories
  lines.push('## Repositories');
  lines.push('');
  renderKind(lines, index.byKind.repository);

  // Call Chains（预留，需 AI 补充）
  lines.push('## Call Chains');
  lines.push('');
  lines.push('_Auto-generation not yet supported. Describe key request flows here._');
  lines.push('');

  return lines.join('\n');
}

function renderKind(lines, entries) {
  if (entries.length === 0) {
    lines.push('_None detected._');
    lines.push('');
    return;
  }
  for (const entry of entries) {
    lines.push(`### \`${entry.file}\``);
    lines.push(entry.exports.map(e => `- \`${e}\``).join('\n'));
    lines.push('');
  }
}

// ─── Staleness 检测 ─────────────────────────────────────────────────────────

function getLatestMtime(dir, exts) {
  let latest = 0;
  for (const file of walkFiles(dir, exts)) {
    try {
      const mtime = statSync(file).mtimeMs;
      if (mtime > latest) latest = mtime;
    } catch {}
  }
  return latest;
}

function checkStaleness(root, indexPath) {
  const lang = detectLanguage(root);
  const exts = langExtensions(lang);
  const srcDirs = ['src', 'app', 'lib', 'pkg', 'cmd', 'internal'].filter(d => existsSync(join(root, d)));
  if (srcDirs.length === 0) srcDirs.push(root);

  let latestSrc = 0;
  for (const d of srcDirs) {
    const m = getLatestMtime(join(root, d), exts);
    if (m > latestSrc) latestSrc = m;
  }

  if (!existsSync(indexPath)) return { stale: true, reason: 'index file missing' };

  const indexMtime = statSync(indexPath).mtimeMs;
  if (latestSrc > indexMtime) {
    const diff = Math.round((Date.now() - indexMtime) / 1000 / 60);
    return { stale: true, reason: `source files changed (index is ${diff}min old)` };
  }
  return { stale: false };
}

// ─── 主命令 ─────────────────────────────────────────────────────────────────

export default async function indexCommand(options) {
  const root = options.cwd || process.cwd();
  const checkOnly = options.check || false;

  // ── 路径 A：codegraph 可用 → 委派，跳过静态扫描 ──────────────────────────
  // commander 把 --no-codegraph 存为 options.codegraph === false
  if (options.codegraph !== false && codegraphAvailable(root)) {
    process.exitCode = delegateToCodegraph(root, checkOnly);
    return;
  }

  // ── 路径 B：降级为正则静态扫描器 ─────────────────────────────────────────
  const loomDir = join(root, '.loom');
  const indexDir = join(loomDir, 'index');
  const indexPath = join(indexDir, 'engineering-index.md');

  if (checkOnly) {
    // ── --check 模式：只做 staleness 检测（非零退出码代表需要更新）──────────
    const result = checkStaleness(root, indexPath);
    if (result.stale) {
      console.error(`\n  ⚠  engineering-index.md is stale: ${result.reason}`);
      console.error(`  Run: loom index\n`);
      process.exitCode = 1;
    } else {
      console.log('\n  ✓ engineering-index.md is up to date\n');
    }
    return;
  }

  // ── 生成模式 ──────────────────────────────────────────────────────────────
  if (!existsSync(loomDir)) {
    console.error('\n  loom index: .loom/ not found. Run /loom-init-project first.\n');
    process.exitCode = 1;
    return;
  }

  console.log('\n  loom index — scanning project...\n');

  const index = buildIndex(root);
  const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const md = renderMarkdown(root, index, timestamp);

  mkdirSync(indexDir, { recursive: true });
  writeFileSync(indexPath, md, 'utf-8');

  console.log(`  Language:  ${index.lang}`);
  console.log(`  Scanned:   ${index.scanned} source files`);
  console.log(`  Routes:    ${index.routes.length} detected`);
  console.log(`  Written:   ${indexPath}`);
  console.log('');
  console.log('  ✓ Done. Review the generated index and add call chains manually.');
  console.log('');
}
