import { mkdirSync, cpSync, writeFileSync, readdirSync, readFileSync, existsSync, rmSync, symlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir, platform } from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');

export class BaseAdapter {
  get toolName() { throw new Error('must implement toolName'); }

  getUserDir() { throw new Error('must implement getUserDir'); }

  getSkillsDir() { return join(this.getUserDir(), 'skills'); }

  getCommandsDir() { return null; }

  supportsPlugin() { return false; }

  install(loomRoot, version) {
    const log = [];
    log.push(`Installing loom@${version} → ${this.toolName} (user-level)`);

    this._copySkills(loomRoot, log);
    this._copyCommands(loomRoot, log);
    this._postInstall(loomRoot, version, log);

    if (this.supportsPlugin()) {
      this._registerPlugin(loomRoot, version, log);
    }

    return log;
  }

  uninstall(loomRoot) {
    const log = [];
    this._removeSkills(log);
    this._removeCommands(log);
    return log;
  }

  _copySkills(loomRoot, log) {
    const src = join(loomRoot, 'skills');
    if (!existsSync(src)) return;
    const dest = this.getSkillsDir();
    mkdirSync(dest, { recursive: true });

    let count = 0;
    const entries = readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillDir = join(src, entry.name);
      const skillMd = join(skillDir, 'SKILL.md');
      if (!existsSync(skillMd)) continue;
      this._copyDir(skillDir, join(dest, entry.name));
      count++;
    }
    log.push(`  skills: ${count} copied → ${dest}`);
  }

  _removeSkills(log) {
    const dest = this.getSkillsDir();
    if (!existsSync(dest)) return;
    const entries = readdirSync(dest, { withFileTypes: true });
    let count = 0;
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillDir = join(dest, entry.name, 'SKILL.md');
      if (!existsSync(skillDir)) continue;
      rmSync(join(dest, entry.name), { recursive: true, force: true });
      count++;
    }
    log.push(`  skills: ${count} removed from ${dest}`);
  }

  _copyCommands(loomRoot, log) {
    const cmdDir = this.getCommandsDir();
    if (!cmdDir) return;
    const src = join(loomRoot, 'commands');
    if (!existsSync(src)) return;
    mkdirSync(cmdDir, { recursive: true });

    let count = 0;
    const entries = readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      cpSync(join(src, entry.name), join(cmdDir, entry.name), { force: true });
      count++;
    }
    log.push(`  commands: ${count} copied → ${cmdDir}`);
  }

  _removeCommands(log) {
    const cmdDir = this.getCommandsDir();
    if (!cmdDir || !existsSync(cmdDir)) return;
    const entries = readdirSync(cmdDir, { withFileTypes: true });
    let count = 0;
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      rmSync(join(cmdDir, entry.name), { force: true });
      count++;
    }
    log.push(`  commands: ${count} removed from ${cmdDir}`);
  }

  _postInstall(loomRoot, version, log) {}

  _registerPlugin(loomRoot, version, log) {}

  _copyDir(src, dest) {
    mkdirSync(dest, { recursive: true });
    const entries = readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const s = join(src, entry.name);
      const d = join(dest, entry.name);
      if (entry.isDirectory()) {
        this._copyDir(s, d);
      } else {
        cpSync(s, d, { force: true });
      }
    }
  }
}
