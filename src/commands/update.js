import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAdapter, listAdapters } from '../adapters/registry.js';
import { parseVersion, needsUpdate } from '../utils/version.js';
import { createBackup, cleanupBackups } from '../utils/backup.js';
import { detectConflicts } from '../utils/conflict.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8'));

function registerPluginClaude(projectRoot) {
  if (process.env.CI) return;
  try {
    execSync('claude plugin update rss', { cwd: projectRoot, stdio: 'pipe' });
  } catch {
    // Plugin may not be installed yet, try install
    try {
      execSync('claude plugin marketplace remove rss', { cwd: projectRoot, stdio: 'pipe' });
    } catch { /* not registered */ }
    try {
      execSync(`claude plugin marketplace add "${projectRoot}"`, { cwd: projectRoot, stdio: 'pipe' });
    } catch { /* ignore */ }
    try {
      execSync('claude plugin install rss@rss --scope project', { cwd: projectRoot, stdio: 'pipe' });
    } catch { /* ignore */ }
  }
  try {
    execSync('claude plugin enable rss@rss --scope project', { cwd: projectRoot, stdio: 'pipe' });
  } catch { /* ignore */ }
}

export default async function update(options) {
  const projectRoot = process.cwd();

  // Auto-detect tool if not specified
  let tool = options.tool;
  if (!tool) {
    tool = detectInstalledTool(projectRoot);
    if (!tool) {
      console.log('\n  No rss installation detected. Run "rss init --tool <target>" first.\n');
      return;
    }
    console.log(`\n  Detected: ${tool}\n`);
  }

  const adapter = getAdapter(tool);
  const targetFiles = adapter.getTargetFiles(projectRoot);

  console.log(`  rss update — ${tool}\n  Project: ${projectRoot}\n`);

  // Check if installed
  const conflicts = detectConflicts(targetFiles);
  const rssManaged = conflicts.filter(c => c.status === 'rss-managed');

  if (rssManaged.length === 0) {
    const anyExist = conflicts.length > 0;
    if (!anyExist) {
      console.log('  not installed. Run "rss init --tool <target>" first.\n');
      return;
    }
    console.log('  Files exist but have no rss version marker. Use "rss init --force" to overwrite.\n');
    return;
  }

  // Check version
  const installedVersion = rssManaged[0].version;
  if (!needsUpdate(installedVersion, pkg.version)) {
    console.log(`  Already up to date (v${installedVersion}).\n`);
    return;
  }

  console.log(`  Updating v${installedVersion} → v${pkg.version}...`);

  if (options.dryRun) {
    console.log('  Dry run — would update the following files:');
    for (const f of targetFiles) {
      console.log(`    - ${f}`);
    }
    console.log('');
    return;
  }

  // Backup
  const existingFiles = rssManaged.map(c => c.file);
  const userCustoms = {};
  for (const file of existingFiles) {
    const content = readFileSync(file, 'utf-8');
    const custom = extractUserCustom(content);
    if (custom) userCustoms[file] = custom;
  }
  const backupPath = createBackup(projectRoot, existingFiles);
  console.log(`  Backup: ${backupPath}`);
  cleanupBackups(projectRoot);

  // Re-generate
  await adapter.generate(projectRoot, pkg.version);

  // Restore USER CUSTOM sections
  for (const file of existingFiles) {
    try {
      const content = readFileSync(file, 'utf-8');
      const restored = restoreUserCustom(content, userCustoms[file]);
      if (restored !== content) {
        writeFileSync(file, restored);
      }
    } catch (e) { console.warn(`  Warning: failed to restore user custom in ${file}:`, e.message); }
  }

  console.log(`  Updated to v${pkg.version}.`);

  // Re-register plugin for Claude Code
  if (tool === 'claude-code') {
    registerPluginClaude(projectRoot);
  }

  console.log('');
}

function detectInstalledTool(projectRoot) {
  for (const tool of listAdapters()) {
    const adapter = getAdapter(tool);
    const files = adapter.getTargetFiles(projectRoot);
    for (const file of files) {
      try {
        const content = readFileSync(file, 'utf-8');
        if (parseVersion(content)) return tool;
      } catch (e) { console.warn(`  Warning: could not read ${file}:`, e.message); }
    }
  }
  return null;
}

const USER_CUSTOM_START = '## --- USER CUSTOM ---';

function extractUserCustom(content) {
  const idx = content.indexOf(USER_CUSTOM_START);
  if (idx === -1) return null;
  return content.slice(idx + USER_CUSTOM_START.length + 1).trimEnd();
}

function restoreUserCustom(content, custom) {
  if (!custom) return content;
  const idx = content.indexOf(USER_CUSTOM_START);
  if (idx === -1) return content + '\n' + USER_CUSTOM_START + '\n' + custom + '\n';
  return content.slice(0, idx + USER_CUSTOM_START.length + 1) + custom + '\n';
}
