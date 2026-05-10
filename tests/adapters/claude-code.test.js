import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, readFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ClaudeCodeAdapter } from '../../src/adapters/claude-code.js';

const TEST_DIR = join(import.meta.dirname, '__test_claude__');

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('ClaudeCodeAdapter', () => {
  const adapter = new ClaudeCodeAdapter();

  it('has name "claude-code"', () => {
    expect(adapter.name).toBe('claude-code');
  });

  it('has entryFilename .claude/CLAUDE.md', () => {
    expect(adapter.entryFilename).toBe('.claude/CLAUDE.md');
  });

  it('getTargetFiles returns .claude/ and .loom/ paths', () => {
    const files = adapter.getTargetFiles(TEST_DIR);
    expect(files).toContainEqual(expect.stringContaining('.loom'));
    expect(files).toContainEqual(expect.stringContaining('.claude'));
    expect(files).not.toContainEqual(expect.stringContaining('.claude-plugin'));
  });

  it('generate creates .claude/CLAUDE.md instead of root CLAUDE.md', async () => {
    await adapter.generate(TEST_DIR, '1.0.0');
    expect(existsSync(join(TEST_DIR, '.claude', 'CLAUDE.md'))).toBe(true);
    expect(existsSync(join(TEST_DIR, 'CLAUDE.md'))).toBe(false);
  });

  it('generate does NOT create root-level skills/ or commands/', async () => {
    await adapter.generate(TEST_DIR, '1.0.0');
    expect(existsSync(join(TEST_DIR, 'skills'))).toBe(false);
    expect(existsSync(join(TEST_DIR, 'commands'))).toBe(false);
  });

  it('generate copies skills to .loom/', async () => {
    await adapter.generate(TEST_DIR, '1.0.0');
    expect(existsSync(join(TEST_DIR, '.loom', 'skills'))).toBe(true);
    const skills = readFileSync(join(TEST_DIR, '.loom', 'skills', 'brainstorming', 'SKILL.md'), 'utf-8');
    expect(skills).toContain('头脑风暴');
  });

  it('generate creates skill wrappers in .claude/skills/', async () => {
    await adapter.generate(TEST_DIR, '1.0.0');
    const wrapperPath = join(TEST_DIR, '.claude', 'skills', 'brainstorming', 'SKILL.md');
    expect(existsSync(wrapperPath)).toBe(true);
    const wrapper = readFileSync(wrapperPath, 'utf-8');
    expect(wrapper).toContain('@.loom/skills/brainstorming/SKILL.md');
    expect(wrapper).toContain('name: brainstorming');
    expect(wrapper).toContain('description: 需求头脑风暴');
  });

  it('generate creates command wrappers in .claude/commands/', async () => {
    await adapter.generate(TEST_DIR, '1.0.0');
    const wrapperPath = join(TEST_DIR, '.claude', 'commands', 'loom-init-project.md');
    expect(existsSync(wrapperPath)).toBe(true);
    const wrapper = readFileSync(wrapperPath, 'utf-8');
    expect(wrapper).toContain('@.loom/commands/loom-init-project.md');
  });

  it('generate does NOT create .claude-plugin/', async () => {
    await adapter.generate(TEST_DIR, '1.0.0');
    expect(existsSync(join(TEST_DIR, '.claude-plugin'))).toBe(false);
  });

  it('generate injects version markers in .claude/CLAUDE.md', async () => {
    await adapter.generate(TEST_DIR, '1.0.0');
    const claudeMd = readFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'), 'utf-8');
    expect(claudeMd).toContain('<!-- loom:version=1.0.0 -->');
  });

  it('generateWrappers resyncs .claude/ from existing .loom/', async () => {
    await adapter.generate(TEST_DIR, '1.0.0');
    expect(existsSync(join(TEST_DIR, '.claude', 'skills', 'brainstorming', 'SKILL.md'))).toBe(true);

    adapter.generateWrappers(TEST_DIR, '2.0.0');
    const claudeMd = readFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'), 'utf-8');
    expect(claudeMd).toContain('<!-- loom:version=2.0.0 -->');
  });
});
