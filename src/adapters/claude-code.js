import { execSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

import { BaseAdapter } from './base.js';

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

  install(loomRoot, version) {
    const log = [];
    log.push(`Installing loom@${version} → ${this.toolName} (user-level)`);
    // Skills and commands are discovered via plugin system — no copy needed
    this._registerPlugin(loomRoot, version, log);
    return log;
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

    try {
      const list = execSync(`${CLAUDE_CMD} plugin list`, EXEC_OPTS).toString();
      if (list.includes(`${pluginName}@`)) {
        log.push(`  plugin: ${plugLabel} already registered (user-level)`);
        return true;
      }
    } catch {}

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

    try { execSync(`${CLAUDE_CMD} plugin marketplace remove ${marketplaceName}`, EXEC_OPTS); } catch {}

    run(`${CLAUDE_CMD} plugin marketplace add "${loomRoot}"`, 'marketplace add', ['already', 'exist']);
    const installed = run(`${CLAUDE_CMD} plugin install ${plugLabel} --scope user`, 'install --scope user');
    if (installed) {
      run(`${CLAUDE_CMD} plugin enable ${plugLabel} --scope user`, 'enable --scope user', ['already enabled']);
    }

    return true;
  }
}
