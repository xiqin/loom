#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CHECK = process.argv.includes('--check');

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
const V = pkg.version;
const NAME = pkg.name;
const DESC = pkg.description;

let outOfSync = 0;

function writeIfChanged(filePath, content) {
  const existing = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : null;
  if (existing === content) {
    console.log(`  \xb7 ${filePath} — already up to date`);
    return;
  }
  if (CHECK) {
    console.error(`  \u2718 ${filePath} — out of sync (expected v${V})`);
    outOfSync++;
    return;
  }
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf-8');
  console.log(`  \u2714 ${filePath} → updated`);
}

writeIfChanged(join(ROOT, '.claude-plugin', 'plugin.json'), JSON.stringify({
  name: NAME,
  version: V,
  description: DESC,
  license: pkg.license || 'MIT',
  keywords: pkg.keywords || [],
  skills: ['./skills'],
  commands: ['./commands'],
}, null, 2) + '\n');

const PLUGIN_NAME = NAME.includes('/') ? NAME.split('/').pop() : NAME.replace(/-engineering$/, '');
writeIfChanged(join(ROOT, '.claude-plugin', 'marketplace.json'), JSON.stringify({
  name: NAME,
  description: DESC,
  owner: { name: pkg.author || 'loom' },
  plugins: [
    {
      name: PLUGIN_NAME,
      description: DESC,
      source: './',
      category: 'development',
    },
  ],
}, null, 2) + '\n');

if (outOfSync > 0) {
  console.error(`\n  ${outOfSync} file(s) out of sync. Run: node scripts/generate-plugin-meta.mjs`);
  process.exit(1);
}
