import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { BaseAdapter } from './base.js';

export class CodexAdapter extends BaseAdapter {
  get toolName() { return 'codex'; }

  getUserDir() {
    const codexHome = process.env.CODEX_HOME?.trim();
    if (!codexHome) return join(homedir(), '.codex');
    if (codexHome === '~') return homedir();
    if (codexHome.startsWith('~/') || codexHome.startsWith('~\\')) {
      return join(homedir(), codexHome.slice(2));
    }
    return codexHome;
  }

  getSkillsDir() { return join(this.getUserDir(), 'skills'); }

  get capabilities() {
    return { hooks: false, skills: true, commands: false, plugin: false, mcpConfig: false, templates: true };
  }

  _postInstall(loomRoot, version, log) {
    this._copyTemplates(loomRoot, log);
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
    mkdirSync(dest, { recursive: true });
    cpSync(src, dest, { recursive: true, force: true });
    log.push('  templates: copied to loom-init-project skill dir');
  }
}
