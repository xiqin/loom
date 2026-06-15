#!/usr/bin/env node

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exitIfOutOfSync, writeIfChanged } from './lib/generate-check.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SCHEMA_PATH = join(ROOT, 'config', 'review.schema.json');

const MARKER_OPEN = '<!-- loom:generate:review-summary -->';
const MARKER_CLOSE = '<!-- /loom:generate:review-summary -->';

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
exitIfOutOfSync();
