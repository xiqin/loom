import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, unlinkSync, existsSync, readdirSync, rmdirSync, rmSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { readManifest } from './manifest.js';
import { execSync } from 'node:child_process';

/**
 * Compute SHA-256 hex digest of a file.
 * Returns null if file doesn't exist or can't be read.
 */
export function fileHash(filePath) {
  try {
    const content = readFileSync(filePath);
    return createHash('sha256').update(content).digest('hex');
  } catch {
    return null;
  }
}

/**
 * Recursively list all files under a directory.
 */
function listFilesRecursive(dir) {
  const results = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...listFilesRecursive(full));
      } else {
        results.push(full);
      }
    }
  } catch { /* dir may not exist */ }
  return results;
}

/**
 * Expand target files list: directories become all files within them.
 * Returns flat list of absolute file paths.
 */
export function expandFiles(targetFiles) {
  const expanded = [];
  for (const f of targetFiles) {
    if (!existsSync(f)) continue;
    const stat = statSync(f);
    if (stat.isDirectory()) {
      expanded.push(...listFilesRecursive(f));
    } else {
      expanded.push(f);
    }
  }
  return expanded;
}

/**
 * Build checksum map for a list of files (expands directories).
 * Returns { relativePath: sha256Hex }
 */
export function buildChecksumMap(projectRoot, targetFiles) {
  const map = {};
  const allFiles = expandFiles(targetFiles);
  for (const f of allFiles) {
    const rel = relative(projectRoot, f);
    const hash = fileHash(f);
    if (hash) map[rel] = hash;
  }
  return map;
}

/**
 * Classify files for uninstall based on manifest checksums.
 *
 * Returns { safe, modified, missing }
 *   safe:    files whose current hash matches manifest → can delete
 *   modified: files whose hash differs → user modified, skip
 *   missing: files that no longer exist → skip
 */
export function classifyFiles(projectRoot, manifest) {
  const safe = [];
  const modified = [];
  const missing = [];

  const checksums = manifest.fileChecksums || {};
  const allFiles = [...(manifest.filesCreated || []), ...(manifest.filesUpdated || [])];

  // Fallback: if no checksums stored (old manifest), treat all as modified
  if (Object.keys(checksums).length === 0) {
    for (const f of allFiles) {
      const abs = join(projectRoot, f);
      if (existsSync(abs)) {
        modified.push(f);
      } else {
        missing.push(f);
      }
    }
    return { safe, modified, missing };
  }

  for (const [rel, expectedHash] of Object.entries(checksums)) {
    const abs = join(projectRoot, rel);
    if (!existsSync(abs)) {
      missing.push(rel);
      continue;
    }
    const currentHash = fileHash(abs);
    if (currentHash === expectedHash) {
      safe.push(rel);
    } else {
      modified.push(rel);
    }
  }

  return { safe, modified, missing };
}

/**
 * Remove empty ancestor directories up to projectRoot.
 * Only removes dirs that are empty after file deletion.
 */
function cleanupEmptyDirs(projectRoot, filePath) {
  let dir = dirname(filePath);
  while (dir !== projectRoot && dir.startsWith(projectRoot)) {
    try {
      const entries = readdirSync(dir);
      if (entries.length === 0) {
        rmdirSync(dir);
        dir = dirname(dir);
      } else {
        break;
      }
    } catch {
      break;
    }
  }
}

/**
 * Unregister Claude Code plugin.
 */
function unregisterPluginClaude(projectRoot) {
  const run = (cmd) => {
    try {
      execSync(cmd, { cwd: projectRoot, stdio: ['pipe', 'pipe', 'pipe'] });
      return true;
    } catch {
      return false;
    }
  };
  run('claude plugin uninstall loom@loom --scope project');
  run(`claude plugin marketplace remove "${projectRoot}"`);
}

/**
 * Core uninstall logic.
 *
 * @param {object} options
 * @param {string} options.tool - Target tool id
 * @param {boolean} [options.dryRun] - Preview only
 * @param {boolean} [options.purge] - Also remove backups and .gitignore entries
 * @returns {object|null} uninstall summary or null if no-op
 */
export async function uninstall(options) {
  const { tool, dryRun = false, purge = false } = options;
  const projectRoot = process.cwd();

  // Read manifest
  const manifest = readManifest(projectRoot);
  if (!manifest) {
    console.log('\n  No manifest found (.loom/install-manifest.json).');
    console.log('  Cannot safely uninstall without manifest.\n');
    return null;
  }

  if (manifest.tool !== tool) {
    console.log(`\n  Manifest records tool "${manifest.tool}", but "${tool}" was requested.`);
    console.log('  Use the correct tool or delete .loom/ manually.\n');
    return null;
  }

  // Classify files
  const { safe, modified, missing } = classifyFiles(projectRoot, manifest);

  // Collect all known files for directory cleanup
  const allKnown = new Set([...safe, ...modified, ...missing]);

  // ── Dry run ─────────────────────────────────────────────────────────
  if (dryRun) {
    console.log(`\n  [dry-run] loom uninstall — ${tool} v${manifest.version}`);
    console.log(`  Project: ${projectRoot}\n`);

    if (safe.length > 0) {
      console.log(`  Would delete (${safe.length} file(s)):`);
      for (const f of safe) console.log(`    - ${f}`);
    }
    if (modified.length > 0) {
      console.log(`\n  Skipped — user modified (${modified.length} file(s)):`);
      for (const f of modified) console.log(`    ! ${f}`);
    }
    if (missing.length > 0) {
      console.log(`\n  Already gone (${missing.length} file(s)):`);
      for (const f of missing) console.log(`    · ${f}`);
    }
    if (tool === 'claude-code') {
      console.log('\n  Would unregister Claude Code plugin.');
    }
    if (purge) {
      console.log('\n  [purge] Would also remove:');
      console.log('    - .loom-backup/ (if exists)');
      console.log('    - .gitignore loom entries (if exists)');
    }
    console.log('\n  Would remove .loom/install-manifest.json');
    console.log('');
    return null;
  }

  // ── Execute uninstall ───────────────────────────────────────────────
  let deleted = 0;
  let skipped = modified.length;

  // Delete safe files
  for (const rel of safe) {
    const abs = join(projectRoot, rel);
    try {
      unlinkSync(abs);
      deleted++;
      cleanupEmptyDirs(projectRoot, abs);
    } catch (e) {
      console.log(`  Warning: could not delete ${rel}: ${e.message}`);
    }
  }

  // Remove manifest
  const manifestPath = join(projectRoot, '.loom', 'install-manifest.json');
  try {
    if (existsSync(manifestPath)) {
      unlinkSync(manifestPath);
      deleted++;
    }
  } catch (e) {
    console.log(`  Warning: could not delete manifest: ${e.message}`);
  }

  // Remove .loom/ — purge: recursive (all ours), normal: only if empty
  const loomDir = join(projectRoot, '.loom');
  try {
    if (existsSync(loomDir)) {
      if (purge) {
        rmSync(loomDir, { recursive: true, force: true });
      } else {
        // Remove empty subdirs then try .loom itself
        const tryRmEmpty = (dir) => {
          try {
            const entries = readdirSync(dir);
            for (const e of entries) {
              const child = join(dir, e);
              if (statSync(child).isDirectory()) tryRmEmpty(child);
            }
            if (readdirSync(dir).length === 0) rmdirSync(dir);
          } catch { /* ignore */ }
        };
        tryRmEmpty(loomDir);
      }
    }
  } catch { /* ignore */ }

  // Unregister plugin
  let hooksRemoved = false;
  if (tool === 'claude-code') {
    unregisterPluginClaude(projectRoot);
    hooksRemoved = true;
    console.log('  Unregistered Claude Code plugin.');
  }

  // ── Purge ───────────────────────────────────────────────────────────
  let purgedBackup = false;
  let purgedGitignore = false;

  if (purge) {
    // Remove .loom-backup/
    const backupDir = join(projectRoot, '.loom-backup');
    if (existsSync(backupDir)) {
      try {
        rmSync(backupDir, { recursive: true, force: true });
        purgedBackup = true;
        console.log('  Removed .loom-backup/');
      } catch (e) {
        console.log(`  Warning: could not remove .loom-backup/: ${e.message}`);
      }
    }

    // Clean .gitignore entries
    const gitignorePath = join(projectRoot, '.gitignore');
    if (existsSync(gitignorePath)) {
      try {
        let content = readFileSync(gitignorePath, 'utf-8');
        const before = content;
        content = content
          .replace(/# loom-engineering\n?/g, '')
          .replace(/\.loom-backup\/\n?/g, '')
          .replace(/\n{2,}/g, '\n')
          .trim();
        if (content !== before) {
          writeFileSync(gitignorePath, content + '\n');
          purgedGitignore = true;
          console.log('  Cleaned .gitignore loom entries');
        }
      } catch (e) {
        console.log(`  Warning: could not clean .gitignore: ${e.message}`);
      }
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────
  const summary = {
    tool,
    version: manifest.version,
    deleted,
    skipped,
    missing: missing.length,
    hooksRemoved,
    purgedBackup,
    purgedGitignore,
  };

  console.log(`\n  Uninstalled ${tool} v${manifest.version}.`);
  console.log(`    deleted: ${deleted}  skipped (modified): ${skipped}  missing: ${missing.length}`);

  if (modified.length > 0) {
    console.log('\n  User-modified files (kept):');
    for (const f of modified) console.log(`    ${f}`);
  }

  console.log('');

  return summary;
}
