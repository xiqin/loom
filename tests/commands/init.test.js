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
    const sp = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { default: init } = await import('../../src/commands/init.js');
    await init({ tool: 'claude-code' });
    expect(existsSync(join(TEST_DIR, 'CLAUDE.md'))).toBe(true);
    sp.mockRestore();
  });

  it('creates .cursorrules for cursor tool', async () => {
    const sp = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { default: init } = await import('../../src/commands/init.js');
    await init({ tool: 'cursor' });
    expect(existsSync(join(TEST_DIR, '.cursorrules'))).toBe(true);
    sp.mockRestore();
  });

  it('creates copilot-instructions.md for copilot tool', async () => {
    const sp = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { default: init } = await import('../../src/commands/init.js');
    await init({ tool: 'copilot' });
    expect(existsSync(join(TEST_DIR, '.github', 'copilot-instructions.md'))).toBe(true);
    sp.mockRestore();
  });

  it('detects conflicts without --force', async () => {
    const sp = vi.spyOn(console, 'log').mockImplementation(() => {});
    writeFileSync(join(TEST_DIR, 'CLAUDE.md'), 'existing');
    const { default: init } = await import('../../src/commands/init.js');
    await init({ tool: 'claude-code' });
    const content = readFileSync(join(TEST_DIR, 'CLAUDE.md'), 'utf-8');
    expect(content).toBe('existing');
    sp.mockRestore();
  });

  it('overwrites with --force and creates backup', async () => {
    const sp = vi.spyOn(console, 'log').mockImplementation(() => {});
    writeFileSync(join(TEST_DIR, 'CLAUDE.md'), 'existing');
    const { default: init } = await import('../../src/commands/init.js');
    await init({ tool: 'claude-code', force: true });
    const content = readFileSync(join(TEST_DIR, 'CLAUDE.md'), 'utf-8');
    expect(content).toContain('loom:version');
    expect(existsSync(join(TEST_DIR, '.loom-backup'))).toBe(true);
    sp.mockRestore();
  });

  it('updates .gitignore', async () => {
    const sp = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { default: init } = await import('../../src/commands/init.js');
    await init({ tool: 'claude-code' });
    const gitignore = readFileSync(join(TEST_DIR, '.gitignore'), 'utf-8');
    expect(gitignore).toContain('.loom-backup/');
    sp.mockRestore();
  });

  it('throws for unknown tool', async () => {
    const sp = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { default: init } = await import('../../src/commands/init.js');
    await expect(init({ tool: 'unknown' })).rejects.toThrow('Unknown tool');
    sp.mockRestore();
  });
});
