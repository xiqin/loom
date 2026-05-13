import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

export class OpenCodeAdapter {
  get toolName() { return 'opencode'; }

  getUserDir() { return join(homedir(), '.config', 'opencode'); }

  getSkillsDir() { return join(this.getUserDir(), 'skills'); }

  getCommandsDir() { return join(this.getUserDir(), 'commands'); }

  supportsPlugin() { return true; }

  install(loomRoot, version) {
    const log = [];
    log.push(`Installing loom@${version} → ${this.toolName} (user-level)`);
    this._copySkills(loomRoot, log);
    this._copyCommands(loomRoot, log);
    this._copyTemplates(loomRoot, log);
    this._addNpmPlugin(loomRoot, log);
    return log;
  }

  uninstall(loomRoot) {
    const log = [];
    log.push(`Uninstalling loom → ${this.toolName} (user-level)`);
    this._removeNpmPlugin(log);
    this._removeSkills(log);
    this._removeTemplates(log);
    this._removeCommands(log);
    return log;
  }

  _addNpmPlugin(loomRoot, log) {
    const configPath = join(this.getUserDir(), 'opencode.json');
    let config = {};
    if (existsSync(configPath)) {
      config = JSON.parse(readFileSync(configPath, 'utf-8'));
    }

    let changed = false;

    if (!config.plugin) config.plugin = [];
    if (!config.plugin.includes('loom-engineering')) {
      config.plugin.push('loom-engineering');
      changed = true;
      log.push('  plugin: loom-engineering added to opencode.json');
    } else {
      log.push('  plugin: loom-engineering already in opencode.json');
    }

    const ignorePatterns = [
      'node_modules', 'vendor', 'dist', 'build', '.cache', '.git',
      '*.lock', '*.log', '__pycache__', '.venv', 'venv',
      '.coverage', '*.pyc', '*.pyo', '*.egg-info', '.tox',
    ];
    if (!config.watcher) config.watcher = {};
    if (!config.watcher.ignore) config.watcher.ignore = [];
    for (const pattern of ignorePatterns) {
      if (!config.watcher.ignore.includes(pattern)) {
        config.watcher.ignore.push(pattern);
        changed = true;
      }
    }
    if (changed) {
      mkdirSync(dirname(configPath), { recursive: true });
      writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
      log.push('  watcher.ignore: merged ignore patterns');
    }
  }

  _removeNpmPlugin(log) {
    const configPath = join(this.getUserDir(), 'opencode.json');
    if (!existsSync(configPath)) return;
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    if (!config.plugin) return;
    const idx = config.plugin.indexOf('loom-engineering');
    if (idx !== -1) {
      config.plugin.splice(idx, 1);
      writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
      log.push('  plugin: loom-engineering removed from opencode.json');
    }
  }

  _copySkills(loomRoot, log) {
    const src = join(loomRoot, 'skills');
    if (!existsSync(src)) return;
    const dest = this.getSkillsDir();
    mkdirSync(dest, { recursive: true });

    const srcNames = new Set();
    let count = 0;
    const entries = readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillDir = join(src, entry.name);
      const skillMd = join(skillDir, 'SKILL.md');
      if (!existsSync(skillMd)) continue;
      srcNames.add(entry.name);
      this._copyDir(skillDir, join(dest, entry.name));
      count++;
    }

    if (existsSync(dest)) {
      for (const entry of readdirSync(dest, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        if (srcNames.has(entry.name)) continue;
        rmSync(join(dest, entry.name), { recursive: true, force: true });
        log.push(`  skills: removed stale ${entry.name}`);
      }
    }

    log.push(`  skills: ${count} copied → ${dest}`);
  }

  _copyCommands(loomRoot, log) {
    const cmdDir = this.getCommandsDir();
    if (!cmdDir) return;
    const src = join(loomRoot, 'commands');
    if (!existsSync(src)) return;
    mkdirSync(cmdDir, { recursive: true });

    const srcNames = new Set();
    let count = 0;
    const entries = readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      srcNames.add(entry.name);
      cpSync(join(src, entry.name), join(cmdDir, entry.name), { force: true });
      count++;
    }

    if (existsSync(cmdDir)) {
      for (const entry of readdirSync(cmdDir, { withFileTypes: true })) {
        if (!entry.isFile()) continue;
        if (srcNames.has(entry.name)) continue;
        rmSync(join(cmdDir, entry.name), { force: true });
        log.push(`  commands: removed stale ${entry.name}`);
      }
    }

    log.push(`  commands: ${count} copied → ${cmdDir}`);
  }

  _copyTemplates(loomRoot, log) {
    const src = join(loomRoot, 'templates');
    if (!existsSync(src)) return;

    const initProjectDir = join(this.getSkillsDir(), 'loom-init-project');
    if (!existsSync(initProjectDir)) {
      log.push('  templates: loom-init-project skill not found, skipped');
      return;
    }

    const dest = join(initProjectDir, 'templates');
    cpSync(src, dest, { recursive: true, force: true });
    log.push('  templates: copied to loom-init-project skill dir');
  }

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

  _removeTemplates(log) {
    const skillsDir = this.getSkillsDir();
    if (!existsSync(skillsDir)) return;

    const initProjectDir = join(skillsDir, 'loom-init-project', 'templates');
    if (existsSync(initProjectDir)) {
      rmSync(initProjectDir, { recursive: true, force: true });
      log.push('  templates: removed from loom-init-project skill dir');
    }
  }
}
