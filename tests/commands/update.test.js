import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const TEST_DIR = join(import.meta.dirname, '__test_update__');

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  vi.spyOn(process, 'cwd').mockReturnValue(TEST_DIR);
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('update command', () => {
  it('reports not installed when no files exist', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { default: update } = await import('../../src/commands/update.js');
    await update({ tool: 'claude-code' });
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('not installed');
    consoleSpy.mockRestore();
  });

  it('reports up to date when version matches', async () => {
    writeFileSync(join(TEST_DIR, 'CLAUDE.md'), '<!-- rss:version=1.0.0 -->\ncontent');
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { default: update } = await import('../../src/commands/update.js');
    await update({ tool: 'claude-code' });
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('up to date');
    consoleSpy.mockRestore();
  });

  it('updates when version differs', async () => {
    writeFileSync(join(TEST_DIR, 'CLAUDE.md'), '<!-- rss:version=0.9.0 -->\nold content');
    const { default: update } = await import('../../src/commands/update.js');
    await update({ tool: 'claude-code' });
    const content = readFileSync(join(TEST_DIR, 'CLAUDE.md'), 'utf-8');
    expect(content).toContain('rss:version=1.0.0');
  });

  it('preserves USER CUSTOM section in cursorrules', async () => {
    const customContent = '# rss:version=0.9.0\nrss content\n## --- USER CUSTOM ---\nmy custom rules';
    writeFileSync(join(TEST_DIR, '.cursorrules'), customContent);
    const { default: update } = await import('../../src/commands/update.js');
    await update({ tool: 'cursor' });
    const content = readFileSync(join(TEST_DIR, '.cursorrules'), 'utf-8');
    expect(content).toContain('my custom rules');
  });
});
