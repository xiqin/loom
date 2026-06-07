import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
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

  it('getRulesDir returns ~/.cursor/rules', () => {
    expect(adapter.getRulesDir()).toContain(join('.cursor', 'rules'));
  });

  it('getSkillsDir returns null (uses .mdc rules)', () => {
    expect(adapter.getSkillsDir()).toBeNull();
  });

  it('getCommandsDir returns null (uses .mdc rules)', () => {
    expect(adapter.getCommandsDir()).toBeNull();
  });

  it('supportsPlugin returns false', () => {
    expect(adapter.supportsPlugin()).toBe(false);
  });

  it('install converts skills to .mdc files', () => {
    vi.spyOn(adapter, 'getUserDir').mockReturnValue(join(TEST_DIR, '.cursor'));

    const loomRoot = join(TEST_DIR, 'loom-root');
    mkdirSync(join(loomRoot, 'skills', 'test-skill'), { recursive: true });
    writeFileSync(join(loomRoot, 'skills', 'test-skill', 'SKILL.md'), `---
name: test-skill
description: A test skill
---
# Test Skill

This is a test skill body.
`);

    const log = adapter.install(loomRoot, '1.0.0');
    expect(log.some(l => l.includes('skills'))).toBe(true);
    expect(log.some(l => l.includes('converted'))).toBe(true);

    const rulesDir = join(TEST_DIR, '.cursor', 'rules');
    expect(existsSync(join(rulesDir, 'loom-test-skill.mdc'))).toBe(true);

    const mdcContent = readFileSync(join(rulesDir, 'loom-test-skill.mdc'), 'utf-8');
    expect(mdcContent).toContain('description:');
    expect(mdcContent).toContain('alwaysApply: false');
    // 紧凑模式：body 包含 MCP 引用而非全文
    expect(mdcContent).toContain('loom_get_skill_context');
  });

  it('install converts commands to .mdc files', () => {
    vi.spyOn(adapter, 'getUserDir').mockReturnValue(join(TEST_DIR, '.cursor'));

    const loomRoot = join(TEST_DIR, 'loom-root');
    mkdirSync(join(loomRoot, 'commands'), { recursive: true });
    writeFileSync(join(loomRoot, 'commands', 'test-cmd.md'), '# /test-cmd\n\nTest command.');

    const log = adapter.install(loomRoot, '1.0.0');
    expect(log.some(l => l.includes('commands'))).toBe(true);
    expect(log.some(l => l.includes('converted'))).toBe(true);

    const rulesDir = join(TEST_DIR, '.cursor', 'rules');
    expect(existsSync(join(rulesDir, 'loom-cmd-test-cmd.mdc'))).toBe(true);
  });

  it('uninstall removes loom-*.mdc files', () => {
    vi.spyOn(adapter, 'getUserDir').mockReturnValue(join(TEST_DIR, '.cursor'));

    const rulesDir = join(TEST_DIR, '.cursor', 'rules');
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(join(rulesDir, 'loom-test-skill.mdc'), 'test');
    writeFileSync(join(rulesDir, 'loom-cmd-test-cmd.mdc'), 'test');
    writeFileSync(join(rulesDir, 'other-rule.mdc'), 'other');

    const log = adapter.uninstall(TEST_DIR);
    expect(log.some(l => l.includes('removed'))).toBe(true);

    expect(existsSync(join(rulesDir, 'loom-test-skill.mdc'))).toBe(false);
    expect(existsSync(join(rulesDir, 'loom-cmd-test-cmd.mdc'))).toBe(false);
    expect(existsSync(join(rulesDir, 'other-rule.mdc'))).toBe(true);
  });

  it('uninstall handles missing rules dir', () => {
    vi.spyOn(adapter, 'getUserDir').mockReturnValue(join(TEST_DIR, '.cursor'));

    const log = adapter.uninstall(TEST_DIR);
    expect(log.some(l => l.includes('no .cursor/rules'))).toBe(true);
  });

  it('convertSkillToMdc handles SKILL.md without frontmatter', () => {
    vi.spyOn(adapter, 'getUserDir').mockReturnValue(join(TEST_DIR, '.cursor'));

    const loomRoot = join(TEST_DIR, 'loom-root');
    mkdirSync(join(loomRoot, 'skills', 'plain-skill'), { recursive: true });
    writeFileSync(join(loomRoot, 'skills', 'plain-skill', 'SKILL.md'), '# Plain Skill\n\nNo frontmatter.');

    const log = adapter.install(loomRoot, '1.0.0');

    const rulesDir = join(TEST_DIR, '.cursor', 'rules');
    expect(existsSync(join(rulesDir, 'loom-plain-skill.mdc'))).toBe(true);
  });

  it('converts multiline skill descriptions into valid mdc frontmatter', () => {
    vi.spyOn(adapter, 'getUserDir').mockReturnValue(join(TEST_DIR, '.cursor'));

    const loomRoot = join(TEST_DIR, 'loom-root');
    mkdirSync(join(loomRoot, 'skills', 'test-skill'), { recursive: true });
    writeFileSync(join(loomRoot, 'skills', 'test-skill', 'SKILL.md'), `---
name: test-skill
description: >
  First line.
  Second line.
---
# Test Skill
`);

    adapter.install(loomRoot, '1.0.0');

    const mdcContent = readFileSync(join(TEST_DIR, '.cursor', 'rules', 'loom-test-skill.mdc'), 'utf-8');
    expect(mdcContent).toMatch(/^---\ndescription: "First line\. Second line\."\nalwaysApply: false\n---/);
    // 紧凑模式包含 MCP 引用
    expect(mdcContent).toContain('loom_get_skill_context');
  });
});
