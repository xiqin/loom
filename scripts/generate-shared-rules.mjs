#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const RULES_PATH = join(ROOT, 'config', 'shared-rules.json');
const SKILLS_DIR = join(ROOT, 'skills');
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

function loadRules() {
  return JSON.parse(readFileSync(RULES_PATH, 'utf-8'));
}

function getMarkerPair(ruleId) {
  return {
    open: `<!-- loom:generate:rule:${ruleId} -->`,
    close: `<!-- /loom:generate:rule:${ruleId} -->`,
  };
}

function injectIntoFile(filePath, markerOpen, markerClose, content) {
  if (!existsSync(filePath)) {
    console.error(`  ✘ ${filePath} — file not found`);
    return false;
  }
  const fileContent = readFileSync(filePath, 'utf-8');
  const startIdx = fileContent.indexOf(markerOpen);
  const endIdx = fileContent.indexOf(markerClose);
  if (startIdx === -1 || endIdx === -1) {
    console.warn(`  ⚠ ${filePath} — markers for rule not found, skipping`);
    return false;
  }
  const newContent = fileContent.slice(0, startIdx + markerOpen.length) + '\n' + content + '\n' + fileContent.slice(endIdx);
  return writeIfChanged(filePath, newContent);
}

function generateRuleMd(rule) {
  let md = `**${rule.heading}**\n\n`;
  md += rule.content;
  return md.trimEnd();
}

const { rules } = loadRules();

console.log('Shared rules generation:\n');

let injectedCount = 0;
for (const rule of rules) {
  const { open, close } = getMarkerPair(rule.id);
  const md = generateRuleMd(rule);
  console.log(`  Rule: ${rule.id} → ${rule.injectTo.join(', ')}`);
  for (const skillName of rule.injectTo) {
    const skillFile = join(SKILLS_DIR, skillName, 'SKILL.md');
    if (injectIntoFile(skillFile, open, close, md)) {
      injectedCount++;
    }
  }
}

console.log(`\n✔ Shared rules generation complete (${injectedCount} injection(s) applied)`);
if (outOfSync > 0) process.exit(1);
