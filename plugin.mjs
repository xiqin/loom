import { existsSync, readdirSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const USER_DIR = join(homedir(), '.config', 'opencode');
const SKILLS_DIR = join(USER_DIR, 'skills');
const COMMANDS_DIR = join(USER_DIR, 'commands');
const MANAGED_SKILL_PREFIX = 'loom-';
const MANAGED_COMMAND_PREFIX = 'loom-';

function copySkills(packageDir, log) {
  const src = join(packageDir, 'skills');
  if (!existsSync(src)) return;

  mkdirSync(SKILLS_DIR, { recursive: true });

  const srcNames = new Set();
  let count = 0;
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillDir = join(src, entry.name);
    const skillMd = join(skillDir, 'SKILL.md');
    if (!existsSync(skillMd)) continue;
    srcNames.add(entry.name);
    cpSync(skillDir, join(SKILLS_DIR, entry.name), { recursive: true, force: true });
    count++;
  }

  if (existsSync(SKILLS_DIR)) {
    for (const entry of readdirSync(SKILLS_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (srcNames.has(entry.name)) continue;
      if (!entry.name.startsWith(MANAGED_SKILL_PREFIX)) continue;
      rmSync(join(SKILLS_DIR, entry.name), { recursive: true, force: true });
      log.push(`  skills: removed stale ${entry.name}`);
    }
  }

  log.push(`  skills: ${count} copied → ${SKILLS_DIR}`);
}

function copyCommands(packageDir, log) {
  const src = join(packageDir, 'commands');
  if (!existsSync(src)) return;

  mkdirSync(COMMANDS_DIR, { recursive: true });

  const srcNames = new Set();
  let count = 0;
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    srcNames.add(entry.name);
    cpSync(join(src, entry.name), join(COMMANDS_DIR, entry.name), { force: true });
    count++;
  }

  if (existsSync(COMMANDS_DIR)) {
    for (const entry of readdirSync(COMMANDS_DIR, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      if (srcNames.has(entry.name)) continue;
      if (!entry.name.startsWith(MANAGED_COMMAND_PREFIX)) continue;
      rmSync(join(COMMANDS_DIR, entry.name), { force: true });
      log.push(`  commands: removed stale ${entry.name}`);
    }
  }

  log.push(`  commands: ${count} copied → ${COMMANDS_DIR}`);
}

function copyTemplates(packageDir, log) {
  const src = join(packageDir, 'templates');
  if (!existsSync(src)) return;

  const initProjectDir = join(SKILLS_DIR, 'loom-init-project');
  if (!existsSync(initProjectDir)) {
    log.push('  templates: loom-init-project skill not found, skipped');
    return;
  }

  const dest = join(initProjectDir, 'templates');
  cpSync(src, dest, { recursive: true, force: true });
  log.push('  templates: copied to loom-init-project skill dir');
}

export const Plugin = async ({ directory }) => {
  const log = [];
  log.push(`Loom plugin initializing...`);

  copySkills(directory, log);
  copyCommands(directory, log);
  copyTemplates(directory, log);

  return {};
};
