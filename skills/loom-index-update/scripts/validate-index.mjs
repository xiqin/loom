#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);

export function validateIndex(options = {}) {
  const root = options.root || process.cwd();
  const errors = [];
  const warnings = [];

  const indexPath = join(root, '.loom', 'index', 'engineering-index.md');
  const memoryPath = join(root, '.loom', 'memory', 'MEMORY.md');
  const codegraphPath = join(root, '.codegraph');

  if (existsSync(codegraphPath)) {
    // codegraph is the live index — engineering-index.md not required
  } else if (!existsSync(indexPath)) {
    errors.push('Missing required file: .loom/index/engineering-index.md (run: loom index)');
  } else {
    const content = readFileSync(indexPath, 'utf8');
    const requiredSections = ['routes', 'controllers', 'services', 'models', 'call chains'];

    for (const section of requiredSections) {
      const pattern = new RegExp(`##\\s*${section}`, 'i');
      if (!pattern.test(content)) {
        errors.push(`engineering-index.md missing required section: ${section}`);
      }
    }
  }

  if (!existsSync(memoryPath)) {
    errors.push('Missing required file: .loom/memory/MEMORY.md');
  } else {
    const content = readFileSync(memoryPath, 'utf8');
    if (!/##\s*Gotchas/i.test(content)) {
      warnings.push('MEMORY.md should include a Gotchas section');
    }
  }

  return { ok: errors.length === 0, errors, warnings, root };
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') options.root = argv[++i];
  }
  return options;
}

function printReport(result) {
  for (const warning of result.warnings) console.warn(`WARN ${warning}`);
  for (const error of result.errors) console.error(`ERROR ${error}`);
  console.log(`Checked index in ${relative(process.cwd(), result.root) || '.'}`);
}

if (process.argv[1] === __filename) {
  const result = validateIndex(parseArgs(process.argv.slice(2)));
  printReport(result);
  if (!result.ok) process.exitCode = 1;
}
