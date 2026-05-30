import { mkdirSync, rmSync, readdirSync, existsSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { convertAllSkills, convertAllCommands } from './cursor-converter.js';
import { codegraphMcpDescriptor } from './base.js';

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

    // 安装 session-init.mdc（等价于 Claude Code session-start hook）
    this._installSessionInit(loomRoot, destDir, log);

    // 写入 MCP server 配置
    this._ensureMcpConfig(log);

    return log;
  }

  _ensureMcpConfig(log) {
    const mcpDir = join(this.getUserDir(), 'mcp');
    const mcpPath = join(mcpDir, 'mcp.json');
    let config = {};
    if (existsSync(mcpPath)) {
      try { config = JSON.parse(readFileSync(mcpPath, 'utf-8')); } catch {}
    }
    if (!config.mcpServers) config.mcpServers = {};
    let changed = false;

    if (config.mcpServers.loom) {
      log.push('  mcp: loom server already configured');
    } else {
      config.mcpServers.loom = { command: 'loom', args: ['mcp-serve'] };
      log.push('  mcp: loom server added to .cursor/mcp/mcp.json');
      changed = true;
    }

    if (config.mcpServers.codegraph) {
      log.push('  mcp: codegraph server already configured');
    } else {
      const codegraph = codegraphMcpDescriptor();
      if (codegraph) {
        config.mcpServers.codegraph = codegraph;
        log.push('  mcp: codegraph server added to .cursor/mcp/mcp.json');
        changed = true;
      } else {
        log.push('  mcp: codegraph CLI not found, skipped (loom index uses static scanner)');
      }
    }

    if (!changed) return;
    mkdirSync(mcpDir, { recursive: true });
    writeFileSync(mcpPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  }

  _installSessionInit(loomRoot, destDir, log) {
    const src = join(loomRoot, 'templates', 'cursor-session-init.mdc');
    if (!existsSync(src)) {
      log.push('  session-init: template not found, skipped');
      return;
    }
    const dest = join(destDir, 'loom-session-init.mdc');
    cpSync(src, dest, { force: true });
    log.push(`  session-init: loom-session-init.mdc written → ${destDir}`);
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
