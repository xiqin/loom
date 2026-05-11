import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CursorAdapter } from '../../src/adapters/cursor.js';

const TEST_DIR = join(import.meta.dirname, '__test_cursor__');

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('CursorAdapter', () => {
  const adapter = new CursorAdapter();

  it('has toolName "cursor"', () => {
    expect(adapter.toolName).toBe('cursor');
  });

  it('getUserDir returns ~/.cursor', () => {
    expect(adapter.getUserDir()).toContain('.cursor');
  });

  it('getSkillsDir returns ~/.cursor/skills', () => {
    expect(adapter.getSkillsDir()).toContain(join('.cursor', 'skills'));
  });

  it('getCommandsDir returns ~/.cursor/commands', () => {
    expect(adapter.getCommandsDir()).toContain(join('.cursor', 'commands'));
  });

  it('supportsPlugin returns false', () => {
    expect(adapter.supportsPlugin()).toBe(false);
  });

  it('install copies skills and commands to user dir', () => {
    vi.spyOn(adapter, 'getUserDir').mockReturnValue(join(TEST_DIR, '.cursor'));

    const loomRoot = join(TEST_DIR, 'loom-root');
    mkdirSync(join(loomRoot, 'skills', 'test-skill'), { recursive: true });
    writeFileSync(join(loomRoot, 'skills', 'test-skill', 'SKILL.md'), '# Test');
    mkdirSync(join(loomRoot, 'commands'), { recursive: true });
    writeFileSync(join(loomRoot, 'commands', 'test-cmd.md'), '# Test Cmd');

    const log = adapter.install(loomRoot, '1.0.0');
    expect(log.some(l => l.includes('skills'))).toBe(true);
    expect(log.some(l => l.includes('commands'))).toBe(true);
    expect(existsSync(join(TEST_DIR, '.cursor', 'skills', 'test-skill', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(TEST_DIR, '.cursor', 'commands', 'test-cmd.md'))).toBe(true);
  });

  it('uninstall removes installed skills and commands', () => {
    vi.spyOn(adapter, 'getUserDir').mockReturnValue(join(TEST_DIR, '.cursor'));

    // Set up installed files
    mkdirSync(join(TEST_DIR, '.cursor', 'skills', 'my-skill'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.cursor', 'skills', 'my-skill', 'SKILL.md'), '# My Skill');
    mkdirSync(join(TEST_DIR, '.cursor', 'commands'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.cursor', 'commands', 'my-cmd.md'), '# My Cmd');

    const log = adapter.uninstall(TEST_DIR);
    expect(log.some(l => l.includes('removed'))).toBe(true);
    expect(existsSync(join(TEST_DIR, '.cursor', 'skills', 'my-skill'))).toBe(false);
    expect(existsSync(join(TEST_DIR, '.cursor', 'commands', 'my-cmd.md'))).toBe(false);
  });
});
