#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);

export function validateIndex(options = {}) {
  const root = options.root || process.cwd();
  const errors = [];
  const warnings = [];

  const storePath = join(root, '.loom', 'memory', 'store.json');
  const memoryPath = join(root, '.loom', 'memory', 'MEMORY.md');
  const codegraphPath = join(root, '.codegraph');

  if (!existsSync(codegraphPath)) {
    warnings.push('codegraph not configured; codegraph sync is skipped');
  }

  if (!existsSync(storePath)) {
    errors.push('Missing required file: .loom/memory/store.json');
  } else {
    try {
      JSON.parse(readFileSync(storePath, 'utf8'));
    } catch (error) {
      errors.push(`Invalid .loom/memory/store.json: ${error.message}`);
    }
  }

  if (!existsSync(memoryPath)) {
    warnings.push('MEMORY.md export view missing; run: loom memory export when needed');
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
