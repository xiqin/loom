import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, readFileSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const TEST_DIR = join(import.meta.dirname, '__test_init__');

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  vi.spyOn(process, 'cwd').mockReturnValue(TEST_DIR);
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('init command', () => {
  it('creates CLAUDE.md for claude-code tool', async () => {
    const { default: init } = await import('../../src/commands/init.js');
    await init({ tool: 'claude-code' });
    expect(existsSync(join(TEST_DIR, 'CLAUDE.md'))).toBe(true);
  });

  it('creates .cursorrules for cursor tool', async () => {
    const { default: init } = await import('../../src/commands/init.js');
    await init({ tool: 'cursor' });
    expect(existsSync(join(TEST_DIR, '.cursorrules'))).toBe(true);
  });

  it('creates copilot-instructions.md for copilot tool', async () => {
    const { default: init } = await import('../../src/commands/init.js');
    await init({ tool: 'copilot' });
    expect(existsSync(join(TEST_DIR, '.github', 'copilot-instructions.md'))).toBe(true);
  });

  it('detects conflicts without --force', async () => {
    writeFileSync(join(TEST_DIR, 'CLAUDE.md'), 'existing');
    const { default: init } = await import('../../src/commands/init.js');
    await init({ tool: 'claude-code' });
    const content = readFileSync(join(TEST_DIR, 'CLAUDE.md'), 'utf-8');
    expect(content).toBe('existing');
  });

  it('overwrites with --force and creates backup', async () => {
    writeFileSync(join(TEST_DIR, 'CLAUDE.md'), 'existing');
    const { default: init } = await import('../../src/commands/init.js');
    await init({ tool: 'claude-code', force: true });
    const content = readFileSync(join(TEST_DIR, 'CLAUDE.md'), 'utf-8');
    expect(content).toContain('rss:version');
    expect(existsSync(join(TEST_DIR, '.rss-backup'))).toBe(true);
  });

  it('updates .gitignore', async () => {
    const { default: init } = await import('../../src/commands/init.js');
    await init({ tool: 'claude-code' });
    const gitignore = readFileSync(join(TEST_DIR, '.gitignore'), 'utf-8');
    expect(gitignore).toContain('.rss-backup/');
  });

  it('throws for unknown tool', async () => {
    const { default: init } = await import('../../src/commands/init.js');
    await expect(init({ tool: 'unknown' })).rejects.toThrow('Unknown tool');
  });
});
