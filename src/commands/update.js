import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAdapter, listAdapters } from '../adapters/registry.js';
import { parseVersion, needsUpdate } from '../utils/version.js';
import { createBackup, cleanupBackups } from '../utils/backup.js';
import { detectConflicts } from '../utils/conflict.js';
import { readManifest, writeManifest, createManifest } from '../core/manifest.js';
import { buildChecksumMap } from '../core/uninstaller.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8'));

export default async function update(options) {
  const projectRoot = process.cwd();

  // Auto-detect tool if not specified
  let tool = options.tool;
  if (!tool) {
    tool = detectInstalledTool(projectRoot);
    if (!tool) {
      console.log('\n  No loom installation detected. Run "loom init --tool <target>" first.\n');
      return;
    }
    console.log(`\n  Detected: ${tool}\n`);
  }

  const adapter = getAdapter(tool);
  const targetFiles = adapter.getTargetFiles(projectRoot);

  console.log(`  loom update — ${tool}\n  Project: ${projectRoot}\n`);

  // Check if installed
  const conflicts = detectConflicts(targetFiles);
  const loomManaged = conflicts.filter(c => c.status === 'loom-managed');

  if (loomManaged.length === 0) {
    const anyExist = conflicts.length > 0;
    if (!anyExist) {
      console.log('  Not installed. Run "loom init --tool <target>" first.\n');
      return;
    }
    console.log('  Files exist but have no loom version marker. Use "loom init --force" to overwrite.\n');
    return;
  }

  // Check version
  const installedVersion = loomManaged[0].version;
  if (!needsUpdate(installedVersion, pkg.version)) {
    console.log(`  Already up to date (v${installedVersion}).\n`);
    return;
  }

  console.log(`  Updating v${installedVersion} → v${pkg.version}...`);

  if (options.dryRun) {
    console.log('  Dry run — would update the following:');
    console.log('    - .loom/ assets (skills, commands, hooks, templates, core)');
    console.log('    - Tool wrappers (.claude/ or equivalent)');
    for (const f of targetFiles) {
      console.log(`    ${f}`);
    }
    console.log('');
    return;
  }

  // Backup
  const existingFiles = loomManaged.map(c => c.file);
  const userCustoms = {};
  for (const file of existingFiles) {
    try {
      const content = readFileSync(file, 'utf-8');
      const custom = extractUserCustom(content);
      if (custom) userCustoms[file] = custom;
    } catch { /* file may not exist yet */ }
  }
  const backupPath = createBackup(projectRoot, existingFiles);
  console.log(`  Backup: ${backupPath}`);
  cleanupBackups(projectRoot);

  // Re-generate .loom/ assets (single source of truth)
  await adapter.generate(projectRoot, pkg.version);

  // Resync tool wrappers from .loom/ sources
  adapter.generateWrappers(projectRoot, pkg.version);

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

  // Update manifest
  const checksums = buildChecksumMap(projectRoot, targetFiles);
  const manifest = createManifest({
    version: pkg.version,
    tool,
    filesCreated: existingFiles.filter(f => {
      try { readFileSync(f); return true; } catch { return false; }
    }),
    filesUpdated: [],
    fileChecksums: checksums,
  });
  writeManifest(projectRoot, manifest);

  console.log(`  Updated to v${pkg.version}.`);
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
      } catch { /* ignore unreadable files */ }
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
