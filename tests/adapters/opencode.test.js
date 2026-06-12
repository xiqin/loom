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

  it('install adds plugin to opencode.json and copies skills', () => {
    vi.spyOn(adapter, 'getUserDir').mockReturnValue(join(TEST_DIR, '.config', 'opencode'));

    const loomRoot = join(TEST_DIR, 'loom-root');
    mkdirSync(join(loomRoot, 'skills', 'test-skill'), { recursive: true });
    writeFileSync(join(loomRoot, 'skills', 'test-skill', 'SKILL.md'), '# Test');

    const log = adapter.install(loomRoot, '1.0.0');
    expect(log.some(l => l.includes('plugin'))).toBe(true);
    expect(log.some(l => l.includes('skills'))).toBe(true);

    const configPath = join(TEST_DIR, '.config', 'opencode', 'opencode.json');
    expect(existsSync(configPath)).toBe(true);
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(config.plugin).toContain('loom-engineering');
  });

  it('install copies skills to target directory', () => {
    vi.spyOn(adapter, 'getUserDir').mockReturnValue(join(TEST_DIR, '.config', 'opencode'));

    const loomRoot = join(TEST_DIR, 'loom-root');
    mkdirSync(join(loomRoot, 'skills', 'test-skill'), { recursive: true });
    writeFileSync(join(loomRoot, 'skills', 'test-skill', 'SKILL.md'), '# Test');

    const log = adapter.install(loomRoot, '1.0.0');
    expect(log.some(l => l.includes('skills'))).toBe(true);
    expect(log.some(l => l.includes('1 copied'))).toBe(true);

    const skillsDir = join(TEST_DIR, '.config', 'opencode', 'skills');
    expect(existsSync(join(skillsDir, 'test-skill'))).toBe(true);
    expect(existsSync(join(skillsDir, 'test-skill', 'SKILL.md'))).toBe(true);
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

  it('uninstall cleans up previously copied skills', () => {
    vi.spyOn(adapter, 'getUserDir').mockReturnValue(join(TEST_DIR, '.config', 'opencode'));
    mkdirSync(join(TEST_DIR, '.config', 'opencode', 'skills', 'loom-test'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.config', 'opencode', 'skills', 'loom-test', 'SKILL.md'), '# Test');
    mkdirSync(join(TEST_DIR, '.config', 'opencode'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.config', 'opencode', 'opencode.json'), JSON.stringify({ plugin: ['loom-engineering'] }));

    adapter.uninstall(TEST_DIR);

    const config = JSON.parse(readFileSync(join(TEST_DIR, '.config', 'opencode', 'opencode.json'), 'utf-8'));
    expect(config.plugin).not.toContain('loom-engineering');
    expect(existsSync(join(TEST_DIR, '.config', 'opencode', 'skills', 'loom-test'))).toBe(false);
  });

  it('install removes stale loom skills but preserves custom skills', () => {
    vi.spyOn(adapter, 'getUserDir').mockReturnValue(join(TEST_DIR, '.config', 'opencode'));

    const skillsDir = join(TEST_DIR, '.config', 'opencode', 'skills');
    mkdirSync(join(skillsDir, 'loom-old'), { recursive: true });
    writeFileSync(join(skillsDir, 'loom-old', 'SKILL.md'), '# Old');
    mkdirSync(join(skillsDir, 'custom-skill'), { recursive: true });
    writeFileSync(join(skillsDir, 'custom-skill', 'SKILL.md'), '# Custom');

    const loomRoot = join(TEST_DIR, 'loom-root');
    mkdirSync(join(loomRoot, 'skills', 'loom-new'), { recursive: true });
    writeFileSync(join(loomRoot, 'skills', 'loom-new', 'SKILL.md'), '# New');

    adapter.install(loomRoot, '1.0.0');

    expect(existsSync(join(skillsDir, 'loom-old'))).toBe(false);
    expect(existsSync(join(skillsDir, 'loom-new'))).toBe(true);
    expect(existsSync(join(skillsDir, 'custom-skill'))).toBe(true);
  });

  it('uninstall preserves custom skills', () => {
    vi.spyOn(adapter, 'getUserDir').mockReturnValue(join(TEST_DIR, '.config', 'opencode'));

    const skillsDir = join(TEST_DIR, '.config', 'opencode', 'skills');
    mkdirSync(join(skillsDir, 'loom-test'), { recursive: true });
    writeFileSync(join(skillsDir, 'loom-test', 'SKILL.md'), '# Loom');
    mkdirSync(join(skillsDir, 'custom-skill'), { recursive: true });
    writeFileSync(join(skillsDir, 'custom-skill', 'SKILL.md'), '# Custom');
    mkdirSync(join(TEST_DIR, '.config', 'opencode'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.config', 'opencode', 'opencode.json'), JSON.stringify({ plugin: ['loom-engineering'] }));

    adapter.uninstall(TEST_DIR);

    expect(existsSync(join(skillsDir, 'loom-test'))).toBe(false);
    expect(existsSync(join(skillsDir, 'custom-skill'))).toBe(true);
  });

  it('_addNpmPlugin does not duplicate existing plugin', () => {
    vi.spyOn(adapter, 'getUserDir').mockReturnValue(join(TEST_DIR, '.config', 'opencode'));
    mkdirSync(join(TEST_DIR, '.config', 'opencode'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.config', 'opencode', 'opencode.json'), JSON.stringify({ plugin: ['loom-engineering'] }));

    const log = [];
    adapter._addNpmPlugin(TEST_DIR, log);
    expect(log.some(l => l.includes('already'))).toBe(true);
    const config = JSON.parse(readFileSync(join(TEST_DIR, '.config', 'opencode', 'opencode.json'), 'utf-8'));
    expect(config.plugin.filter(p => p === 'loom-engineering').length).toBe(1);
  });

  it('_ensureMcpConfig backs up invalid opencode.json before rebuilding', () => {
    vi.spyOn(adapter, 'getUserDir').mockReturnValue(join(TEST_DIR, '.config', 'opencode'));
    mkdirSync(join(TEST_DIR, '.config', 'opencode'), { recursive: true });
    const configPath = join(TEST_DIR, '.config', 'opencode', 'opencode.json');
    writeFileSync(configPath, '{ bad json');

    const log = [];
    adapter._ensureMcpConfig(log);

    expect(existsSync(configPath + '.bak')).toBe(true);
    expect(readFileSync(configPath + '.bak', 'utf-8')).toBe('{ bad json');
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(config.mcp.loom.command).toEqual(['loom', 'mcp-serve']);
    expect(log.some(l => l.includes('解析失败'))).toBe(true);
  });
});
