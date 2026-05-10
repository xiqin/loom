import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getAdapter, listAdapters } from '../adapters/registry.js';
import { parseVersion } from '../utils/version.js';

function uninstallPluginClaude(projectRoot) {
  try {
    execSync('claude plugin uninstall loom@loom --scope project', { cwd: projectRoot, stdio: 'pipe' });
  } catch {
    // plugin may not be installed
  }
  try {
    execSync(`claude plugin marketplace remove "${projectRoot}"`, { cwd: projectRoot, stdio: 'pipe' });
  } catch {
    // marketplace may not be registered
  }
}

function cleanGitignore(projectRoot) {
  const gitignorePath = join(projectRoot, '.gitignore');
  if (!existsSync(gitignorePath)) return;

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
      console.log('  Cleaned .gitignore loom entries');
    }
  } catch {
    // best effort
  }
}

export default async function uninstall(options) {
  const projectRoot = process.cwd();
  const { purge = false } = options;

  // Auto-detect tool if not specified
  let tool = options.tool;
  if (!tool) {
    tool = detectInstalledTool(projectRoot);
    if (!tool) {
      console.log('\n  No loom installation detected.\n');
      return;
    }
    console.log(`\n  Detected: ${tool}\n`);
  }

  const adapter = getAdapter(tool);
  console.log(`  loom uninstall — ${tool}\n  Project: ${projectRoot}\n`);

  // Verify installation exists
  const entryFile = join(projectRoot, adapter.entryFilename);
  if (existsSync(entryFile)) {
    const content = readFileSync(entryFile, 'utf-8');
    if (!parseVersion(content)) {
      console.log(`  ${adapter.entryFilename} exists but is not loom-managed. Skipped.\n`);
    } else {
      unlinkSync(entryFile);
      console.log(`  Removed ${adapter.entryFilename}`);
    }
  }

  // Unregister plugin for claude-code
  if (tool === 'claude-code') {
    uninstallPluginClaude(projectRoot);
    console.log('  Unregistered Claude Code plugin');
  }

  // Remove tool-specific directories
  if (tool === 'claude-code') {
    rmIfExists(join(projectRoot, '.claude-plugin'));
    rmIfExists(join(projectRoot, 'skills'));
    rmIfExists(join(projectRoot, 'commands'));
  } else if (tool === 'opencode') {
    rmIfExists(join(projectRoot, '.opencode'));
  }

  // Remove common .loom directory
  rmIfExists(join(projectRoot, '.loom'));

  // --purge: additional cleanup
  if (purge) {
    cleanGitignore(projectRoot);
    rmIfExists(join(projectRoot, '.loom-backup'));
    console.log('  Purge complete (backups and .gitignore entries removed).');
  }

  console.log('  Uninstalled.\n');
}

function rmIfExists(path) {
  if (existsSync(path)) {
    rmSync(path, { recursive: true, force: true });
    console.log(`  Removed ${path}`);
  }
}

function detectInstalledTool(projectRoot) {
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
