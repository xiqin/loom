#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PIPELINE_PATH = join(ROOT, 'config', 'pipeline.schema.json');
const SKILLS_DIR = join(ROOT, 'skills');

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

function markerPair(stateId) {
  return {
    open: `<!-- loom:generate:progress:${stateId} -->`,
    close: `<!-- /loom:generate:progress:${stateId} -->`,
  };
}

function injectIntoFile(filePath, open, close, content) {
  if (!existsSync(filePath)) {
    console.error(`  ✘ ${filePath} — file not found`);
    return false;
  }
  const fileContent = readFileSync(filePath, 'utf-8');
  const startIdx = fileContent.indexOf(open);
  const endIdx = fileContent.indexOf(close);
  if (startIdx === -1 || endIdx === -1) {
    console.warn(`  ⚠ ${filePath} — progress markers not found, skipping`);
    return false;
  }
  const newContent = fileContent.slice(0, startIdx + open.length) + '\n' + content + '\n' + fileContent.slice(endIdx);
  return writeIfChanged(filePath, newContent);
}

function statusLabel(schema, key) {
  const item = schema.progressFileFormat?.statusValues?.[key];
  return item ? `${item.symbol} ${item.label}` : key;
}

function generateProgressMd(schema, stateId, state) {
  const step = state.step;
  const running = statusLabel(schema, 'running');
  const done = statusLabel(schema, 'done');
  const failed = statusLabel(schema, 'failed');
  const waiting = statusLabel(schema, 'waiting');
  const outputs = (state.outputs || []).map(item => `\`${item.path}\``).join('、') || '本阶段产物';
  const startVerb = stateId === 'brainstorming' ? '创建' : '更新';
  const createNote = stateId === 'brainstorming'
    ? `- 开始时${startVerb} \`${schema.progressFileFormat.path}\`：Step ${step} 设为 \`${running}\`，后续步骤设为 \`${waiting}\`。`
    : `- 开始时${startVerb} \`${schema.progressFileFormat.path}\`：Step ${step} 设为 \`${running}\`，开始时间填当前 HH:mm，并追加 Skill 调用记录。`;
  const failNote = (state.allowedTransitions || []).includes('failed')
    ? `- 失败时：Step ${step} 设为 \`${failed}\`，完成时间填失败时 HH:mm，备注写明阻断原因。`
    : null;

  return [
    '**progress.md 更新（由 `config/pipeline.schema.json` 生成）**',
    '',
    `- 阶段：Step ${step} / \`${stateId}\` / \`${state.skill}\`。`,
    createNote,
    `- 完成时：Step ${step} 设为 \`${done}\`，完成时间填当前 HH:mm，并把本 skill 调用记录结果更新为 \`${done}\`。`,
    failNote,
    `- 备注列按阶段产物填写：${outputs}；执行阶段可记录 task 进度，worktree 阶段可记录分支名。`,
    '- 时间必须填实际 `HH:mm` 数值，如 `14:30`；禁止填字面量 `HH:mm`。',
  ].filter(Boolean).join('\n');
}

const schema = JSON.parse(readFileSync(PIPELINE_PATH, 'utf-8'));

console.log('Progress rules generation:\n');

let injected = 0;
for (const [stateId, state] of Object.entries(schema.states || {})) {
  if (state.step == null || !state.skill) continue;
  const skillFile = join(SKILLS_DIR, state.skill, 'SKILL.md');
  const { open, close } = markerPair(stateId);
  console.log(`  State: ${stateId} -> ${state.skill}`);
  if (injectIntoFile(skillFile, open, close, generateProgressMd(schema, stateId, state))) {
    injected++;
  }
}

console.log(`\n✔ Progress rules generation complete (${injected} injection(s) applied)`);
