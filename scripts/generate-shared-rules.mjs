#!/usr/bin/env node

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exitIfOutOfSync, writeIfChanged } from './lib/generate-check.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const RULES_PATH = join(ROOT, 'config', 'shared-rules.json');
const SKILLS_DIR = join(ROOT, 'skills');

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
exitIfOutOfSync();
