import { mkdirSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { convertAllSkills, convertAllCommands } from './cursor-converter.js';

export class CursorAdapter {
  get toolName() { return 'cursor'; }

  getUserDir() { return join(homedir(), '.cursor'); }

  getRulesDir() { return join(this.getUserDir(), 'rules'); }

  getSkillsDir() { return null; }

  getCommandsDir() { return null; }

  supportsPlugin() { return false; }

  install(loomRoot, version) {
    const log = [];
    log.push(`Installing loom@${version} → ${this.toolName} (user-level)`);

    const skillsSrc = join(loomRoot, 'skills');
    const cmdsSrc = join(loomRoot, 'commands');
    const destDir = this.getRulesDir();

    mkdirSync(destDir, { recursive: true });

    const skillCount = convertAllSkills(skillsSrc, destDir, log);
    log.push(`  skills: ${skillCount} converted → ${destDir} (loom-*.mdc)`);

    const cmdCount = convertAllCommands(cmdsSrc, destDir, log);
    if (cmdCount > 0) log.push(`  commands: ${cmdCount} converted → ${destDir} (loom-cmd-*.mdc)`);

    return log;
  }

  uninstall(loomRoot) {
    const log = [];
    log.push(`Uninstalling loom → ${this.toolName} (user-level)`);

    const rulesDir = this.getRulesDir();
    if (!existsSync(rulesDir)) {
      log.push('  rules: no .cursor/rules directory found');
      return log;
    }

    let count = 0;
    for (const entry of readdirSync(rulesDir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      if (!entry.name.startsWith('loom-') || !entry.name.endsWith('.mdc')) continue;
      rmSync(join(rulesDir, entry.name), { force: true });
      count++;
    }
    log.push(`  rules: ${count} loom-*.mdc removed from ${rulesDir}`);

    return log;
  }
}
