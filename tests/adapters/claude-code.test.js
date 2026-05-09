import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
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

  it('has entryFilename CLAUDE.md', () => {
    expect(adapter.entryFilename).toBe('CLAUDE.md');
  });

  it('getTargetFiles returns expected paths', () => {
    const files = adapter.getTargetFiles(TEST_DIR);
    expect(files).toContainEqual(expect.stringContaining('.rss'));
    expect(files).toContainEqual(expect.stringContaining('CLAUDE.md'));
    expect(files).toContainEqual(expect.stringContaining('.claude-plugin'));
  });

  it('generate creates directory structure', async () => {
    await adapter.generate(TEST_DIR, '1.0.0');
    expect(existsSync(join(TEST_DIR, '.rss', 'skills'))).toBe(true);
    expect(existsSync(join(TEST_DIR, 'CLAUDE.md'))).toBe(true);
    expect(existsSync(join(TEST_DIR, '.claude-plugin', 'plugin.json'))).toBe(true);
  });

  it('generate injects version markers', async () => {
    await adapter.generate(TEST_DIR, '1.0.0');
    const claudeMd = readFileSync(join(TEST_DIR, 'CLAUDE.md'), 'utf-8');
    expect(claudeMd).toContain('<!-- rss:version=1.0.0 -->');
  });

  it('generate copies skills', async () => {
    await adapter.generate(TEST_DIR, '1.0.0');
    const skills = readFileSync(join(TEST_DIR, '.rss', 'skills', 'brainstorming', 'SKILL.md'), 'utf-8');
    expect(skills).toContain('头脑风暴');
  });
});
