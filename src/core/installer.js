import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAdapter, listAdapters } from '../adapters/registry.js';
import { detectConflicts, ensureGitignore } from '../utils/conflict.js';
import { createBackup, cleanupBackups } from '../utils/backup.js';
import { parseVersion, needsUpdate } from '../utils/version.js';
import { writeManifest, createManifest } from './manifest.js';
import { buildChecksumMap } from './uninstaller.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8'));

/**
 * Snapshot file states before generation.
 * Returns Map<absolutePath, { exists, mtime }>
 */
function snapshotFiles(files) {
  const snap = new Map();
  for (const f of files) {
    try {
      const stat = statSync(f);
      snap.set(f, { exists: true, mtime: stat.mtimeMs });
    } catch {
      snap.set(f, { exists: false, mtime: 0 });
    }
  }
  return snap;
}

/**
 * Diff before/after snapshots to determine created vs updated files.
 */
function diffSnapshots(before, after) {
  const created = [];
  const updated = [];
  for (const [file, afterState] of after) {
    const beforeState = before.get(file);
    if (!beforeState?.exists && afterState.exists) {
      created.push(file);
    } else if (beforeState?.exists && afterState.exists && afterState.mtime !== beforeState.mtime) {
      updated.push(file);
    }
  }
  return { created, updated };
}

/**
 * Detect installed tool by scanning for loom-managed files.
 */
export function detectInstalledTool(projectRoot) {
  for (const tool of listAdapters()) {
    const adapter = getAdapter(tool);
    const entryFile = join(projectRoot, adapter.entryFilename);
    if (existsSync(entryFile)) {
      const content = readFileSync(entryFile, 'utf-8');
      if (parseVersion(content)) return tool;
    }
  }
  return null;
}

/**
 * Core installer — handles init and update flows with manifest tracking.
 *
 * @param {object} options
 * @param {string} options.tool - Target tool id
 * @param {string} [options.version] - Override version (default: package.json version)
 * @param {boolean} [options.dryRun] - Preview only
 * @param {boolean} [options.force] - Overwrite conflicting files
 * @param {boolean} [options.update] - Update mode (skip if same version)
 * @returns {object|null} manifest or null if dry-run/no-op
 */
export async function install(options) {
  const {
    tool,
    version = pkg.version,
    dryRun = false,
    force = false,
    update = false,
  } = options;

  const adapter = getAdapter(tool);
  const projectRoot = process.cwd();
  const targetFiles = adapter.getTargetFiles(projectRoot);
  const conflicts = detectConflicts(targetFiles);

  const loomManaged = conflicts.filter(c => c.status === 'loom-managed');
  const hasConflicts = conflicts.filter(c => c.status === 'conflict');

  // ── Update mode: check version ─────────────────────────────────────
  if (update) {
    if (loomManaged.length === 0) {
      console.log('  Not installed. Run "loom init --tool <target>" first.\n');
      return null;
    }
    const installedVersion = loomManaged[0].version;
    if (!needsUpdate(installedVersion, version)) {
      console.log(`  Already up to date (v${installedVersion}).\n`);
      return null;
    }
    console.log(`  Updating v${installedVersion} → v${version}...`);
  }

  // ── Init mode: already installed? ──────────────────────────────────
  if (!update && loomManaged.length > 0) {
    const current = loomManaged[0];
    if (current.version === version && !force) {
      console.log(`  Already installed (v${current.version}). Use 'loom update' to update.\n`);
      return null;
    }
  }

  // ── Conflicts without force ────────────────────────────────────────
  if (hasConflicts.length > 0 && !force) {
    console.log('  Conflicts detected:');
    for (const c of hasConflicts) console.log(`    - ${c.file}: ${c.reason}`);
    console.log('\n  Use --force to overwrite (backs up existing files first).\n');
    return null;
  }

  // ── Dry run ────────────────────────────────────────────────────────
  if (dryRun) {
    const action = update ? 'update' : 'install';
    console.log(`\n  [dry-run] loom ${action} — ${tool} v${version}`);
    console.log(`  Project: ${projectRoot}\n`);
    console.log('  Files to be generated:');
    for (const f of targetFiles) console.log(`    ${f}`);
    if (hasConflicts.length > 0) {
      console.log(`\n  Would backup ${hasConflicts.length} conflicting file(s):`);
      for (const c of hasConflicts) console.log(`    ${c.file}`);
    }
    console.log(`\n  Would write manifest to .loom/install-manifest-${tool}.json`);
    console.log('');
    return null;
  }

  // ── Backup ─────────────────────────────────────────────────────────
  const backedUp = [];
  if (hasConflicts.length > 0) {
    const conflictFiles = hasConflicts.map(c => c.file);
    const backupPath = createBackup(projectRoot, conflictFiles);
    backedUp.push(backupPath);
    console.log(`  Backup: ${backupPath}`);
    cleanupBackups(projectRoot);
  }

  // ── Snapshot before ────────────────────────────────────────────────
  const before = snapshotFiles(targetFiles);

  // ── Generate ───────────────────────────────────────────────────────
  console.log(`  Generating ${tool} files...`);
  await adapter.generate(projectRoot, version, { dryRun: false, force });

  // ── Snapshot after & diff ──────────────────────────────────────────
  const after = snapshotFiles(targetFiles);
  const { created, updated: updatedFiles } = diffSnapshots(before, after);

  // ── Gitignore ──────────────────────────────────────────────────────
  ensureGitignore(projectRoot);

  // ── Compute checksums for created + updated files ───────────────────
  const allChanged = [...created, ...updatedFiles];
  const checksums = buildChecksumMap(projectRoot, allChanged);

  // ── Write manifest ─────────────────────────────────────────────────
  const manifest = createManifest({
    version,
    tool,
    filesCreated: created,
    filesUpdated: updatedFiles,
    backups: backedUp,
    fileChecksums: checksums,
  });
  writeManifest(projectRoot, manifest);

  // ── Summary ────────────────────────────────────────────────────────
  console.log(`\n  Installed v${version} (${tool}).`);
  console.log(`    created: ${created.length}  updated: ${updatedFiles.length}  backed-up: ${backedUp.length}`);
    console.log(`    manifest: .loom/install-manifest-${tool}.json\n`);

  return manifest;
}
