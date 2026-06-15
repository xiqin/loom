import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CodexAdapter } from '../../src/adapters/codex.js';

const TEST_DIR = join(import.meta.dirname, '__test_codex__');
const ORIGINAL_CODEX_HOME = process.env.CODEX_HOME;

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  delete process.env.CODEX_HOME;
});

afterEach(() => {
  vi.restoreAllMocks();
  if (ORIGINAL_CODEX_HOME === undefined) {
    delete process.env.CODEX_HOME;
  } else {
    process.env.CODEX_HOME = ORIGINAL_CODEX_HOME;
  }
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('CodexAdapter', () => {
  const adapter = new CodexAdapter();

  it('has toolName "codex"', () => {
    expect(adapter.toolName).toBe('codex');
  });

  it('getUserDir defaults to ~/.codex', () => {
    expect(adapter.getUserDir()).toContain('.codex');
  });

  it('getUserDir respects CODEX_HOME', () => {
    process.env.CODEX_HOME = join(TEST_DIR, 'custom-codex-home');
    expect(adapter.getUserDir()).toBe(process.env.CODEX_HOME);
  });

  it('advertises MCP config support', () => {
    expect(adapter.capabilities.mcpConfig).toBe(true);
  });

  it('installs skills and templates without removing non-loom skills', () => {
    vi.spyOn(adapter, 'getUserDir').mockReturnValue(join(TEST_DIR, '.codex'));

    const loomRoot = join(TEST_DIR, 'loom-root');
    mkdirSync(join(loomRoot, 'skills', 'loom-init-project'), { recursive: true });
    writeFileSync(join(loomRoot, 'skills', 'loom-init-project', 'SKILL.md'), '# Init');
    mkdirSync(join(loomRoot, 'templates'), { recursive: true });
    writeFileSync(join(loomRoot, 'templates', 'constitution.md'), '# Template');

    const skillsDir = join(TEST_DIR, '.codex', 'skills');
    mkdirSync(join(skillsDir, 'custom-skill'), { recursive: true });
    writeFileSync(join(skillsDir, 'custom-skill', 'SKILL.md'), '# Custom');
    mkdirSync(join(skillsDir, 'loom-old-skill'), { recursive: true });
    writeFileSync(join(skillsDir, 'loom-old-skill', 'SKILL.md'), '# Old');

    const log = adapter.install(loomRoot, '1.0.0');

    expect(existsSync(join(skillsDir, 'custom-skill', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(skillsDir, 'loom-old-skill'))).toBe(false);
    expect(existsSync(join(skillsDir, 'loom-init-project', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(skillsDir, 'loom-init-project', 'templates', 'constitution.md'))).toBe(true);
    expect(existsSync(join(TEST_DIR, '.codex', 'config.toml'))).toBe(true);
    expect(log.some(l => l.includes('templates'))).toBe(true);
    expect(log.some(l => l.includes('mcp: loom server added'))).toBe(true);
  });

  it('writes Codex MCP server config without overwriting existing config', () => {
    vi.spyOn(adapter, 'getUserDir').mockReturnValue(join(TEST_DIR, '.codex'));

    const codexDir = join(TEST_DIR, '.codex');
    mkdirSync(codexDir, { recursive: true });
    writeFileSync(join(codexDir, 'config.toml'), 'model = "gpt-5"\n\n[mcp_servers.existing]\ncommand = "existing"\n');

    const loomRoot = join(TEST_DIR, 'loom-root');
    mkdirSync(join(loomRoot, 'skills', 'loom-init-project'), { recursive: true });
    writeFileSync(join(loomRoot, 'skills', 'loom-init-project', 'SKILL.md'), '# Init');

    adapter.install(loomRoot, '1.0.0');

    const config = readFileSync(join(codexDir, 'config.toml'), 'utf-8');
    expect(config).toContain('model = "gpt-5"');
    expect(config).toContain('[mcp_servers.existing]');
    expect(config).toContain('[mcp_servers.loom]');
    expect(config).toContain('command = "loom"');
    expect(config).toContain('args = ["mcp-serve"]');
    expect(config).toContain('env = { LOOM_LAZY_TOOLS = "1" }');
  });

  it('does not duplicate an existing loom MCP server config', () => {
    vi.spyOn(adapter, 'getUserDir').mockReturnValue(join(TEST_DIR, '.codex'));

    const codexDir = join(TEST_DIR, '.codex');
    mkdirSync(codexDir, { recursive: true });
    writeFileSync(join(codexDir, 'config.toml'), '[mcp_servers.loom]\ncommand = "custom-loom"\nargs = []\n');

    const loomRoot = join(TEST_DIR, 'loom-root');
    mkdirSync(join(loomRoot, 'skills', 'loom-init-project'), { recursive: true });
    writeFileSync(join(loomRoot, 'skills', 'loom-init-project', 'SKILL.md'), '# Init');

    const log = adapter.install(loomRoot, '1.0.0');
    const config = readFileSync(join(codexDir, 'config.toml'), 'utf-8');

    expect(config.match(/\[mcp_servers\.loom\]/g)).toHaveLength(1);
    expect(config).toContain('command = "custom-loom"');
    expect(log.some(l => l.includes('loom server already configured'))).toBe(true);
  });

  it('backs up unreadable config.toml before rebuilding MCP config', () => {
    vi.spyOn(adapter, 'getUserDir').mockReturnValue(join(TEST_DIR, '.codex'));

    const codexDir = join(TEST_DIR, '.codex');
    const configPath = join(codexDir, 'config.toml');
    mkdirSync(configPath, { recursive: true });

    const log = [];
    adapter._ensureMcpConfig(log);

    expect(existsSync(`${configPath}.bak`)).toBe(true);
    const config = readFileSync(configPath, 'utf-8');
    expect(config).toContain('[mcp_servers.loom]');
    expect(log.some(l => l.includes('读取失败'))).toBe(true);
  });

  it('uninstall removes only loom skills', () => {
    vi.spyOn(adapter, 'getUserDir').mockReturnValue(join(TEST_DIR, '.codex'));

    const skillsDir = join(TEST_DIR, '.codex', 'skills');
    mkdirSync(join(skillsDir, 'loom-test'), { recursive: true });
    writeFileSync(join(skillsDir, 'loom-test', 'SKILL.md'), '# Test');
    mkdirSync(join(skillsDir, 'custom-skill'), { recursive: true });
    writeFileSync(join(skillsDir, 'custom-skill', 'SKILL.md'), '# Custom');

    adapter.uninstall(TEST_DIR);

    expect(existsSync(join(skillsDir, 'loom-test'))).toBe(false);
    expect(existsSync(join(skillsDir, 'custom-skill', 'SKILL.md'))).toBe(true);
  });

  it('uninstall removes only the loom MCP section', () => {
    vi.spyOn(adapter, 'getUserDir').mockReturnValue(join(TEST_DIR, '.codex'));

    const codexDir = join(TEST_DIR, '.codex');
    mkdirSync(codexDir, { recursive: true });
    writeFileSync(join(codexDir, 'config.toml'), [
      'model = "gpt-5"',
      '',
      '[mcp_servers.loom]',
      'command = "loom"',
      'args = ["mcp-serve"]',
      '',
      '[mcp_servers.other]',
      'command = "other"',
      '',
    ].join('\n'));

    const log = adapter.uninstall(TEST_DIR);
    const config = readFileSync(join(codexDir, 'config.toml'), 'utf-8');

    expect(config).not.toContain('[mcp_servers.loom]');
    expect(config).toContain('model = "gpt-5"');
    expect(config).toContain('[mcp_servers.other]');
    expect(log.some(l => l.includes('mcp: loom server removed'))).toBe(true);
  });
});
