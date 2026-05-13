import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getUserAdapter, USER_TOOL_IDS } from '../core/installer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');
const pkg = JSON.parse(readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf-8'));

export default async function doctor(options) {
  const tools = options.tool ? [options.tool] : USER_TOOL_IDS;

  console.log(`\n  loom doctor — Diagnosis Report\n`);

  let foundAny = false;

  for (const tool of tools) {
    if (!USER_TOOL_IDS.includes(tool)) {
      console.log(`  Unknown tool: "${tool}". Supported: ${USER_TOOL_IDS.join(', ')}`);
      continue;
    }

    const adapter = await getUserAdapter(tool);
    const userDir = adapter.getUserDir();

    let hasSkills = false;
    let hasCommands = false;

    if (tool === 'cursor') {
      hasSkills = checkCursorMdc(adapter);
    } else {
      const skillsDir = adapter.getSkillsDir();
      const cmdDir = adapter.getCommandsDir();

      hasSkills = skillsDir && existsSync(skillsDir) && readdirSync(skillsDir, { withFileTypes: true }).some(e => e.isDirectory());
      hasCommands = cmdDir && existsSync(cmdDir) && readdirSync(cmdDir, { withFileTypes: true }).some(e => e.isFile() && e.name.endsWith('.md'));
    }

    if (!hasSkills && !hasCommands) continue;
    foundAny = true;

    console.log(`  [${tool}]`);
    console.log(`    user dir:  ${userDir}`);

    if (tool === 'cursor') {
      const rulesDir = adapter.getRulesDir();
      if (existsSync(rulesDir)) {
        const mdcFiles = readdirSync(rulesDir).filter(f => f.startsWith('loom-') && f.endsWith('.mdc'));
        const skillCount = mdcFiles.filter(f => !f.startsWith('loom-cmd-')).length;
        const cmdCount = mdcFiles.filter(f => f.startsWith('loom-cmd-')).length;
        console.log(`    rules:     ${rulesDir}`);
        console.log(`    skills:    ${skillCount} skill(s) as .mdc`);
        if (cmdCount > 0) console.log(`    commands:  ${cmdCount} command(s) as .mdc`);
      }
    } else {
      const skillsDir = adapter.getSkillsDir();
      if (skillsDir && existsSync(skillsDir)) {
        const count = countSkillDirs(skillsDir);
        console.log(`    skills:    ${skillsDir} (${count} skill(s))`);
      }

      const cmdDir = adapter.getCommandsDir();
      if (cmdDir) {
        if (existsSync(cmdDir)) {
          const count = readdirSync(cmdDir).filter(f => f.endsWith('.md')).length;
          console.log(`    commands:  ${cmdDir} (${count} command(s))`);
        } else {
          console.log(`    commands:  (none)`);
        }
      }
    }

    if (adapter.supportsPlugin()) {
      console.log(`    plugin:    registered`);
    }

    console.log('');
  }

  if (!foundAny) {
    console.log('  No loom installation detected. Run "loom install --tool <target>" to install.');
  }
}

function countSkillDirs(dir) {
  let count = 0;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillMd = join(dir, entry.name, 'SKILL.md');
        if (existsSync(skillMd)) count++;
      }
    }
  } catch {}
  return count;
}

function checkCursorMdc(adapter) {
  try {
    const rulesDir = adapter.getRulesDir();
    if (!rulesDir || !existsSync(rulesDir)) return false;
    return readdirSync(rulesDir).some(f => f.startsWith('loom-') && f.endsWith('.mdc'));
  } catch {
    return false;
  }
}
