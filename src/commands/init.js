import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAdapter } from '../adapters/registry.js';
import { detectConflicts, ensureGitignore } from '../utils/conflict.js';
import { createBackup, cleanupBackups } from '../utils/backup.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8'));

/**
 * Register plugin via Claude Code CLI (marketplace add + install + enable).
 */
function registerPluginClaude(projectRoot) {
  try {
    // Check if already installed
    const list = execSync('claude plugin list', { cwd: projectRoot, stdio: ['pipe', 'pipe', 'pipe'] }).toString();
    if (list.includes('rss@')) {
      // Already installed, ensure enabled
      try {
        execSync('claude plugin enable rss@rss --scope project', { cwd: projectRoot, stdio: 'pipe' });
      } catch { /* ignore */ }
      return false;
    }
  } catch { /* continue */ }

  try {
    execSync(`claude plugin marketplace add "${projectRoot}"`, { cwd: projectRoot, stdio: 'pipe' });
  } catch (e) {
    const msg = e.stderr?.toString() || e.message || '';
    if (!msg.includes('already') && !msg.includes('exist')) {
      console.log(`  Warning: marketplace add failed: ${msg.trim()}`);
    }
  }

  try {
    execSync('claude plugin install rss@rss --scope project', { cwd: projectRoot, stdio: 'pipe' });
  } catch (e) {
    const msg = e.stderr?.toString() || e.message || '';
    if (!msg.includes('already') && !msg.includes('exist')) {
      console.log(`  Warning: plugin install failed: ${msg.trim()}`);
      return false;
    }
  }

  // Enable the plugin (installed plugins are disabled by default)
  try {
    execSync('claude plugin enable rss@rss --scope project', { cwd: projectRoot, stdio: 'pipe' });
  } catch (e) {
    const msg = e.stderr?.toString() || e.message || '';
    if (!msg.includes('already')) {
      console.log(`  Warning: plugin enable failed: ${msg.trim()}`);
    }
  }

  return true;
}

export default async function init(options) {
  const { tool, dryRun = false, force = false } = options;

  const adapter = getAdapter(tool);
  const projectRoot = process.cwd();

  console.log(`\n  rss init — ${tool}\n  Project: ${projectRoot}\n`);

  // Check conflicts
  const targetFiles = adapter.getTargetFiles(projectRoot);
  const conflicts = detectConflicts(targetFiles);

  const hasExistingRss = conflicts.filter(c => c.status === 'rss-managed');
  const hasConflicts = conflicts.filter(c => c.status === 'conflict');

  // Already installed with same version
  if (hasExistingRss.length > 0) {
    const current = hasExistingRss[0];
    if (current.version === pkg.version) {
      // Still ensure plugin is registered
      if (tool === 'claude-code' && registerPluginClaude(projectRoot)) {
        console.log('  Registered as Claude Code plugin.');
      }
      console.log(`  Already installed (v${current.version}). Use 'rss update' to update.`);
      return;
    }
  }

  // Conflicts without force
  if (hasConflicts.length > 0 && !force) {
    console.log('  Conflicts detected:');
    for (const c of hasConflicts) {
      console.log(`    - ${c.file}: ${c.reason}`);
    }
    console.log('\n  Use --force to overwrite (backs up existing files first).');
    return;
  }

  if (dryRun) {
    console.log('  Dry run — files to be generated:');
    for (const f of targetFiles) {
      console.log(`    - ${f}`);
    }
    return;
  }

  // Backup if force and conflicts exist
  if (force && hasConflicts.length > 0) {
    const conflictFiles = hasConflicts.map(c => c.file);
    const backupPath = createBackup(projectRoot, conflictFiles);
    console.log(`  Backup created: ${backupPath}`);
    cleanupBackups(projectRoot);
  }

  // Generate
  console.log(`  Generating ${tool} files...`);
  await adapter.generate(projectRoot, pkg.version, { dryRun, force });

  // Update .gitignore
  ensureGitignore(projectRoot);

  // Register plugin for Claude Code
  if (tool === 'claude-code') {
    if (registerPluginClaude(projectRoot)) {
      console.log('  Registered as Claude Code plugin.');
    }
  }

  console.log(`  Done! Run 'rss doctor' to verify installation.\n`);
}
