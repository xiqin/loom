#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SCHEMA_PATH = join(ROOT, 'config', 'model-selection.schema.json');

const MARKER_OPEN = '<!-- loom:generate:model-selection -->';
const MARKER_CLOSE = '<!-- /loom:generate:model-selection -->';

function writeIfChanged(filePath, content) {
  const existing = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : '';
  if (existing === content) {
    console.log(`  · ${filePath} — already up to date`);
    return false;
  }
  writeFileSync(filePath, content, 'utf-8');
  console.log(`  ✔ ${filePath}`);
  return true;
}

function loadSchema() {
  return JSON.parse(readFileSync(SCHEMA_PATH, 'utf-8'));
}

function generateModelSelectionMd(schema) {
  let md = `## ${schema.sectionTitle}\n\n`;
  md += `${schema.intro}\n\n`;

  for (const tier of schema.tiers) {
    const scope = tier.scope ? `（${tier.scope}）` : '';
    md += `**${tier.label}**${scope}：使用${tier.model}`;
    if (tier.rationale) md += `。${tier.rationale}`;
    md += '\n\n';
  }

  md += `**任务复杂度信号：**\n\n`;
  for (const signal of schema.signals) {
    md += `- ${signal.condition} → ${schema.tiers.find(t => t.id === signal.tier).label.replace('任务', '').trim() || schema.tiers.find(t => t.id === signal.tier).label}模型\n`;
  }

  // Fix: "机械实现任务模型" → "便宜模型"
  md = md.replace(/机械实现模型/g, '便宜模型');
  md = md.replace(/集成和判断模型/g, '标准模型');
  md = md.replace(/架构、设计和审查模型/g, '最强模型');

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
const md = generateModelSelectionMd(schema);

console.log('Model selection generation:\n');

injectIntoFile(join(ROOT, 'skills', 'loom-subagent-driven-development', 'SKILL.md'), md);
injectIntoFile(join(ROOT, 'skills', 'loom-writing-plans', 'SKILL.md'), md);

console.log('\n✔ Model selection generation complete');
