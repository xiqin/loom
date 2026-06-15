import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ClaudeCodeAdapter } from '../../src/adapters/claude-code.js';

const TEST_DIR = join(import.meta.dirname, '__test_claude__');

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('ClaudeCodeAdapter', () => {
  const adapter = new ClaudeCodeAdapter();

  it('has toolName "claude-code"', () => {
    expect(adapter.toolName).toBe('claude-code');
  });

  it('getUserDir returns ~/.claude', () => {
    expect(adapter.getUserDir()).toContain('.claude');
  });

  it('getSkillsDir returns ~/.claude/skills', () => {
    expect(adapter.getSkillsDir()).toContain(join('.claude', 'skills'));
  });

  it('getCommandsDir returns null (plugin system handles it)', () => {
    expect(adapter.getCommandsDir()).toBeNull();
  });

  it('supportsPlugin returns true', () => {
    expect(adapter.supportsPlugin()).toBe(true);
  });

  it('install returns log array', () => {
    // Mock homedir to use TEST_DIR
    vi.spyOn(adapter, 'getUserDir').mockReturnValue(join(TEST_DIR, '.claude'));
    vi.spyOn(adapter, 'supportsPlugin').mockReturnValue(false);

    // Create a minimal loom root with skills
    const loomRoot = join(TEST_DIR, 'loom-root');
    mkdirSync(join(loomRoot, 'skills', 'test-skill'), { recursive: true });
    writeFileSync(join(loomRoot, 'skills', 'test-skill', 'SKILL.md'), '# Test Skill');

    const log = adapter.install(loomRoot, '1.0.0');
    expect(Array.isArray(log)).toBe(true);
    expect(log.some(l => l.includes('Installing'))).toBe(true);
  });

  it('uninstall returns log array', () => {
    vi.spyOn(adapter, 'getUserDir').mockReturnValue(join(TEST_DIR, '.claude'));
    const log = adapter.uninstall(TEST_DIR);
    expect(Array.isArray(log)).toBe(true);
    expect(log.some(l => l.includes('Uninstalling'))).toBe(true);
  });

  it('backs up invalid settings.json before rebuilding MCP config', () => {
    vi.spyOn(adapter, 'getUserDir').mockReturnValue(join(TEST_DIR, '.claude'));

    const settingsPath = join(TEST_DIR, '.claude', 'settings.json');
    mkdirSync(join(TEST_DIR, '.claude'), { recursive: true });
    writeFileSync(settingsPath, '{ invalid json', 'utf-8');

    const log = [];
    adapter._ensureMcpConfig(log);

    expect(readFileSync(`${settingsPath}.bak`, 'utf-8')).toBe('{ invalid json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    expect(settings.mcpServers.loom.command).toBe('loom');
    expect(log.some(l => l.includes('解析失败'))).toBe(true);
  });
});
