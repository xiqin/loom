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
  if (process.env.CI) return false;
  try {
    // Check if already installed and healthy
    const list = execSync('claude plugin list', { cwd: projectRoot, stdio: ['pipe', 'pipe', 'pipe'] }).toString();
    if (list.includes('rss@')) {
      if (list.includes('✔ enabled')) {
        return false;
      }
      // Plugin exists but is broken — uninstall first
      execSync('claude plugin uninstall rss@rss --scope project', { cwd: projectRoot, stdio: 'pipe' });
    }
  } catch { /* claude CLI not available or list failed */ }

  // Remove stale marketplace registration, then re-register
  try { execSync('claude plugin marketplace remove rss', { cwd: projectRoot, stdio: 'pipe' }); } catch {}

  const run = (cmd, opts = {}) => {
    try { execSync(cmd, { cwd: projectRoot, stdio: 'pipe' }); return true; }
    catch (e) {
      const msg = e.stderr?.toString() || e.message || '';
      const silent = opts.silent || [];
      if (!silent.some(s => msg.includes(s))) {
        console.log(`  Warning: ${opts.label || cmd}: ${msg.trim()}`);
      }
      return false;
    }
  };

  run(`claude plugin marketplace add "${projectRoot}"`, { label: 'marketplace add', silent: ['already', 'exist'] });
  run('claude plugin install rss@rss --scope project', { label: 'plugin install', silent: ['already', 'exist'] });
  run('claude plugin enable rss@rss --scope project', { label: 'plugin enable', silent: ['already'] });

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

  console.log(`  Done.\n`);
}
