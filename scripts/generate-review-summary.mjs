#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SCHEMA_PATH = join(ROOT, 'config', 'review.schema.json');

const MARKER_OPEN = '<!-- loom:generate:review-summary -->';
const MARKER_CLOSE = '<!-- /loom:generate:review-summary -->';
const CHECK = process.env.LOOM_GENERATE_CHECK === '1' || process.argv.includes('--check');
let outOfSync = 0;

function writeIfChanged(filePath, content) {
  const existing = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : '';
  if (existing === content) {
    console.log(`  · ${filePath} — already up to date`);
    return false;
  }
  if (CHECK) {
    console.error(`  ✘ ${filePath} — out of sync`);
    outOfSync++;
    return false;
  }
  writeFileSync(filePath, content, 'utf-8');
  console.log(`  ✔ ${filePath}`);
  return true;
}

function loadSchema() {
  return JSON.parse(readFileSync(SCHEMA_PATH, 'utf-8'));
}

function generateReviewSummaryMd(schema) {
  let md = `### 6 维审查\n\n`;
  md += `| 维度 | 关键检查项 |\n`;
  md += `|------|----------|\n`;
  for (const dim of schema.dimensions) {
    const topChecks = dim.checks.slice(0, 2).join('、');
    md += `| ${dim.name} | ${topChecks} |\n`;
  }
  return md.trimEnd();
}

function injectIntoFile(filePath, content) {
  if (!existsSync(filePath)) {
    console.error(`  ✘ ${filePath} — file not found`);
    return false;
  }
  const fileContent = readFileSync(filePath, 'utf-8');
  const startIdx = fileContent.indexOf(MARKER_OPEN);
  const endIdx = fileContent.indexOf(MARKER_CLOSE);
  if (startIdx === -1 || endIdx === -1) {
    console.warn(`  ⚠ ${filePath} — markers not found, skipping`);
    return false;
  }
  const newContent = fileContent.slice(0, startIdx + MARKER_OPEN.length) + '\n' + content + '\n' + fileContent.slice(endIdx);
  return writeIfChanged(filePath, newContent);
}

const schema = loadSchema();
const md = generateReviewSummaryMd(schema);

console.log('Review summary generation:\n');

injectIntoFile(join(ROOT, 'README.md'), md);
injectIntoFile(join(ROOT, 'skills', 'loom-using-loom', 'SKILL.md'), md);

console.log('\n✔ Review summary generation complete');
if (outOfSync > 0) process.exit(1);
