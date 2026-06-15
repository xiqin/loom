import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { BaseAdapter, codegraphMcpDescriptor } from './base.js';
import { readTextConfig } from './config-utils.js';

function tomlString(value) {
  return JSON.stringify(value);
}

function tomlArray(values = []) {
  return `[${values.map(v => tomlString(v)).join(', ')}]`;
}

function tomlKey(key) {
  return /^[A-Za-z0-9_-]+$/.test(key) ? key : tomlString(key);
}

function tomlInlineTable(entries = {}) {
  return `{ ${Object.entries(entries).map(([k, v]) => `${tomlKey(k)} = ${tomlString(v)}`).join(', ')} }`;
}

function sectionBounds(lines, sectionName) {
  const header = `[mcp_servers.${sectionName}]`;
  const start = lines.findIndex(line => line.trim() === header);
  if (start === -1) return null;

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      end = i;
      break;
    }
  }
  return { start, end };
}

function hasMcpServer(configText, name) {
  return Boolean(sectionBounds(configText.split(/\r?\n/), name));
}

function appendMcpServer(configText, name, descriptor) {
  const lines = configText.trimEnd().split(/\r?\n/);
  const body = [
    `[mcp_servers.${name}]`,
    `command = ${tomlString(descriptor.command)}`,
    `args = ${tomlArray(descriptor.args || [])}`,
  ];
  if (descriptor.env && Object.keys(descriptor.env).length > 0) {
    body.push(`env = ${tomlInlineTable(descriptor.env)}`);
  }
  const prefix = configText.trim() ? `${lines.join('\n')}\n\n` : '';
  return `${prefix}${body.join('\n')}\n`;
}

function removeMcpServer(configText, name) {
  const lines = configText.split(/\r?\n/);
  const bounds = sectionBounds(lines, name);
  if (!bounds) return { changed: false, text: configText };

  lines.splice(bounds.start, bounds.end - bounds.start);
  return { changed: true, text: lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n' };
}

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
    return { hooks: false, skills: true, commands: false, plugin: false, mcpConfig: true, templates: true };
  }

  _postInstall(loomRoot, version, log) {
    this._copyTemplates(loomRoot, log);
    this._ensureMcpConfig(log);
  }

  uninstall(loomRoot) {
    const log = super.uninstall(loomRoot);
    this._removeMcpConfig(log);
    return log;
  }

  _getConfigPath() {
    return join(this.getUserDir(), 'config.toml');
  }

  _ensureMcpConfig(log) {
    const configPath = this._getConfigPath();
    let config = readTextConfig(configPath, { log, label: 'mcp', name: 'config.toml' });

    let changed = false;
    if (hasMcpServer(config, 'loom')) {
      log.push('  mcp: loom server already configured');
    } else {
      config = appendMcpServer(config, 'loom', { command: 'loom', args: ['mcp-serve'], env: { LOOM_LAZY_TOOLS: '1' } });
      log.push('  mcp: loom server added to config.toml');
      changed = true;
    }

    if (hasMcpServer(config, 'codegraph')) {
      log.push('  mcp: codegraph server already configured');
    } else {
      const codegraph = codegraphMcpDescriptor();
      if (codegraph) {
        config = appendMcpServer(config, 'codegraph', codegraph);
        log.push('  mcp: codegraph server added to config.toml');
        changed = true;
      } else {
        log.push('  mcp: codegraph CLI not found, codegraph indexing disabled');
      }
    }

    if (!changed) return;
    mkdirSync(dirname(configPath), { recursive: true });
    writeFileSync(configPath, config, 'utf-8');
  }

  _removeMcpConfig(log) {
    const configPath = this._getConfigPath();
    if (!existsSync(configPath)) return;

    const original = readFileSync(configPath, 'utf-8');
    const result = removeMcpServer(original, 'loom');
    if (!result.changed) return;

    writeFileSync(configPath, result.text, 'utf-8');
    log.push('  mcp: loom server removed from config.toml');
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
