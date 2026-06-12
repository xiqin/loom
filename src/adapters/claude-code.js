import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

import { BaseAdapter, codegraphMcpDescriptor } from './base.js';

const EXEC_OPTS = { stdio: 'pipe', timeout: 10_000 };
const CLAUDE_CMD = process.platform === 'win32' ? 'claude.cmd' : 'claude';

function _readMarketplaceNames(loomRoot) {
  try {
    const meta = JSON.parse(readFileSync(join(loomRoot, '.claude-plugin', 'marketplace.json'), 'utf-8'));
    const pluginName = meta.plugins && meta.plugins[0] && meta.plugins[0].name;
    return { marketplaceName: meta.name, pluginName: pluginName || 'loom' };
  } catch {
    return { marketplaceName: 'loom', pluginName: 'loom' };
  }
}

export class ClaudeCodeAdapter extends BaseAdapter {
  get toolName() { return 'claude-code'; }

  getUserDir() { return join(homedir(), '.claude'); }

  supportsPlugin() { return true; }

  get capabilities() {
    return { hooks: true, skills: false, commands: false, plugin: true, mcpConfig: true };
  }

  install(loomRoot, version) {
    const log = [];
    log.push(`Installing loom@${version} → ${this.toolName} (user-level)`);
    this._registerPlugin(loomRoot, version, log);
    this._ensureIgnore(log);
    this._ensureMcpConfig(log);
    return log;
  }

  _ensureMcpConfig(log) {
    const settingsPath = join(this.getUserDir(), 'settings.json');
    let settings = {};
    if (existsSync(settingsPath)) {
      try { settings = JSON.parse(readFileSync(settingsPath, 'utf-8')); } catch {}
    }
    if (!settings.mcpServers) settings.mcpServers = {};
    let changed = false;

    if (settings.mcpServers.loom) {
      log.push('  mcp: loom server already configured');
    } else {
      settings.mcpServers.loom = { command: 'loom', args: ['mcp-serve'], env: { LOOM_LAZY_TOOLS: '1' } };
      log.push('  mcp: loom server added to settings.json');
      changed = true;
    }

    if (settings.mcpServers.codegraph) {
      log.push('  mcp: codegraph server already configured');
    } else {
      const codegraph = codegraphMcpDescriptor();
      if (codegraph) {
        settings.mcpServers.codegraph = codegraph;
        log.push('  mcp: codegraph server added to settings.json');
        changed = true;
      } else {
        log.push('  mcp: codegraph CLI not found, codegraph indexing disabled');
      }
    }

    if (!changed) return;
    mkdirSync(dirname(settingsPath), { recursive: true });
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
  }

  uninstall(loomRoot) {
    const log = [];
    log.push(`Uninstalling loom → ${this.toolName} (user-level)`);
    this._unregisterPlugin(loomRoot, log);
    return log;
  }

  _unregisterPlugin(loomRoot, log) {
    if (process.env.CI) return;
    const { marketplaceName, pluginName } = _readMarketplaceNames(loomRoot);
    const plugLabel = `${pluginName}@${marketplaceName}`;

    // 1. Uninstall the plugin
    try {
      execSync(`${CLAUDE_CMD} plugin uninstall ${plugLabel}`, EXEC_OPTS);
      log.push(`  plugin: ${plugLabel} uninstalled`);
    } catch {
      log.push(`  plugin: ${plugLabel} not installed`);
    }

    // 2. Remove the marketplace
    try {
      execSync(`${CLAUDE_CMD} plugin marketplace remove ${marketplaceName}`, EXEC_OPTS);
      log.push(`  marketplace: ${marketplaceName} removed`);
    } catch {
      log.push(`  marketplace: ${marketplaceName} not found`);
    }

    // 3. Clean up cache (marketplace remove doesn't always clear it)
    const cacheDir = join(this.getUserDir(), 'plugins', 'cache', marketplaceName);
    if (existsSync(cacheDir)) {
      try {
        rmSync(cacheDir, { recursive: true, force: true });
        log.push(`  cache: ${marketplaceName} cleared`);
      } catch (e) {
        log.push(`  cache: ${e.message}`);
      }
    }
  }

  _registerPlugin(loomRoot, version, log) {
    if (process.env.CI) return false;
    const { marketplaceName, pluginName } = _readMarketplaceNames(loomRoot);
    const plugLabel = `${pluginName}@${marketplaceName}`;

    const run = (cmd, label, silent = []) => {
      try {
        execSync(cmd, EXEC_OPTS);
        log.push(`  plugin: ${label} — ok`);
        return true;
      } catch (e) {
        const msg = e.stderr?.toString() || e.message || '';
        const trimmed = msg.trim();
        if (silent.some(kw => trimmed.includes(kw))) return true;
        log.push(`  plugin: ${label} — ${trimmed}`);
        return false;
      }
    };

    // Always remove then reinstall to pick up updates
    try { execSync(`${CLAUDE_CMD} plugin uninstall ${plugLabel}`, EXEC_OPTS); } catch {}
    try { execSync(`${CLAUDE_CMD} plugin marketplace remove ${marketplaceName}`, EXEC_OPTS); } catch {}

    run(`${CLAUDE_CMD} plugin marketplace add "${loomRoot}"`, 'marketplace add', ['already', 'exist']);
    const installed = run(`${CLAUDE_CMD} plugin install ${plugLabel} --scope user`, 'install --scope user');
    if (installed) {
      run(`${CLAUDE_CMD} plugin enable ${plugLabel} --scope user`, 'enable --scope user', ['already enabled']);
    }

    return true;
  }

  _ensureIgnore(log) {
    const ignorePath = join(this.getUserDir(), '.claudeignore');
    const marker = '# Generated by loom';

    if (existsSync(ignorePath)) {
      const content = readFileSync(ignorePath, 'utf-8');
      if (content.includes(marker)) {
        log.push('  .claudeignore: already managed by loom, updated');
      } else {
        log.push('  .claudeignore: exists (not managed by loom), skipped');
        return;
      }
    }

    const content = `${marker}
node_modules/
vendor/
dist/
build/
.cache/
.git/
*.lock
*.log
__pycache__/
.venv/
venv/
.coverage/
*.pyc
*.pyo
*.egg-info/
.tox/
`;
    mkdirSync(dirname(ignorePath), { recursive: true });
    writeFileSync(ignorePath, content, 'utf-8');
    log.push('  .claudeignore: written');
  }
}
