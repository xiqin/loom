import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OpenCodeAdapter } from '../../src/adapters/opencode.js';

const TEST_DIR = join(import.meta.dirname, '__test_opencode__');

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(async () => {
  vi.restoreAllMocks();
  for (let i = 0; i < 3; i++) {
    try {
      rmSync(TEST_DIR, { recursive: true, force: true });
      return;
    } catch (e) {
      if (e.code === 'EBUSY' && i < 2) {
        await new Promise(r => setTimeout(r, 100));
      } else if (i === 2) {
      } else {
        throw e;
      }
    }
  }
});

describe('OpenCodeAdapter', () => {
  const adapter = new OpenCodeAdapter();

  it('has toolName "opencode"', () => {
    expect(adapter.toolName).toBe('opencode');
  });

  it('getUserDir returns ~/.config/opencode', () => {
    expect(adapter.getUserDir()).toContain(join('.config', 'opencode'));
  });

  it('getSkillsDir returns ~/.config/opencode/skills', () => {
    expect(adapter.getSkillsDir()).toContain(join('.config', 'opencode', 'skills'));
  });

  it('getCommandsDir returns ~/.config/opencode/commands', () => {
    expect(adapter.getCommandsDir()).toContain(join('.config', 'opencode', 'commands'));
  });

  it('supportsPlugin returns true', () => {
    expect(adapter.supportsPlugin()).toBe(true);
  });

  it('install adds plugin to opencode.json and copies commands', () => {
    vi.spyOn(adapter, 'getUserDir').mockReturnValue(join(TEST_DIR, '.config', 'opencode'));

    const loomRoot = join(TEST_DIR, 'loom-root');
    mkdirSync(join(loomRoot, 'commands'), { recursive: true });
    writeFileSync(join(loomRoot, 'commands', 'test-cmd.md'), '# Test');

    const log = adapter.install(loomRoot, '1.0.0');
    expect(log.some(l => l.includes('plugin'))).toBe(true);
    expect(log.some(l => l.includes('commands'))).toBe(true);

    const configPath = join(TEST_DIR, '.config', 'opencode', 'opencode.json');
    expect(existsSync(configPath)).toBe(true);
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(config.plugin).toContain('loom-engineering');
  });

  it('uninstall removes plugin from opencode.json', () => {
    vi.spyOn(adapter, 'getUserDir').mockReturnValue(join(TEST_DIR, '.config', 'opencode'));
    mkdirSync(join(TEST_DIR, '.config', 'opencode'), { recursive: true });
    const configPath = join(TEST_DIR, '.config', 'opencode', 'opencode.json');
    writeFileSync(configPath, JSON.stringify({ plugin: ['loom-engineering', 'other'] }));

    adapter.uninstall(TEST_DIR);
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(config.plugin).not.toContain('loom-engineering');
    expect(config.plugin).toContain('other');
  });
});
