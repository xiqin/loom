import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { version: CURRENT_VERSION } = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8'));
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
    expect(output).toContain('Not installed');
    consoleSpy.mockRestore();
  });

  it('reports up to date when version matches', async () => {
    mkdirSync(join(TEST_DIR, '.claude'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'), `<!-- loom:version=${CURRENT_VERSION} -->\ncontent`);
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { default: update } = await import('../../src/commands/update.js');
    await update({ tool: 'claude-code' });
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('up to date');
    consoleSpy.mockRestore();
  });

  it('updates when version differs', async () => {
    mkdirSync(join(TEST_DIR, '.claude'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'), '<!-- loom:version=0.9.0 -->\nold content');
    const { default: update } = await import('../../src/commands/update.js');
    await update({ tool: 'claude-code' });
    const content = readFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'), 'utf-8');
    expect(content).toContain(`loom:version=${CURRENT_VERSION}`);
  });

  it('preserves USER CUSTOM section in cursorrules', async () => {
    const customContent = '# loom:version=0.9.0\nloom content\n## --- USER CUSTOM ---\nmy custom rules';
    writeFileSync(join(TEST_DIR, '.cursorrules'), customContent);
    const { default: update } = await import('../../src/commands/update.js');
    await update({ tool: 'cursor' });
    const content = readFileSync(join(TEST_DIR, '.cursorrules'), 'utf-8');
    expect(content).toContain('my custom rules');
  });
});
