import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { BaseAdapter } from './base.js';

export class OpenCodeAdapter extends BaseAdapter {
  get toolName() { return 'opencode'; }

  getUserDir() { return join(homedir(), '.config', 'opencode'); }

  getSkillsDir() { return join(this.getUserDir(), 'skills'); }

  getCommandsDir() { return join(this.getUserDir(), 'commands'); }

  supportsPlugin() { return true; }

  install(loomRoot, version) {
    const log = [];
    log.push(`Installing loom@${version} → ${this.toolName} (user-level)`);
    this._addNpmPlugin(loomRoot, log);
    this._copySkills(loomRoot, log);
    this._copyCommands(loomRoot, log);
    this._postInstall(loomRoot, version, log);
    return log;
  }

  uninstall(loomRoot) {
    const log = [];
    this._removeNpmPlugin(log);
    this._removeSkills(log);
    this._removeCommands(log);
    return log;
  }

  _addNpmPlugin(loomRoot, log) {
    const configPath = join(this.getUserDir(), 'opencode.json');
    let config = {};
    if (existsSync(configPath)) {
      config = JSON.parse(readFileSync(configPath, 'utf-8'));
    }
    if (!config.plugin) config.plugin = [];
    if (!config.plugin.includes('loom-engineering')) {
      config.plugin.push('loom-engineering');
      mkdirSync(dirname(configPath), { recursive: true });
      writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
      log.push('  plugin: loom-engineering added to opencode.json');
    } else {
      log.push('  plugin: loom-engineering already in opencode.json');
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

  _postInstall(loomRoot, version, log) {
    log.push('  config: commands copied, skills via npm plugin (loom-engineering)');
  }
}
