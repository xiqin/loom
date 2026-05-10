import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const TEST_DIR = join(import.meta.dirname, '__test_doctor__');

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  vi.spyOn(process, 'cwd').mockReturnValue(TEST_DIR);
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('doctor command', () => {
  it('reports installation status when files exist', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mkdirSync(join(TEST_DIR, '.claude'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'), '<!-- loom:version=1.0.0 -->\ncontent');
    mkdirSync(join(TEST_DIR, '.loom', 'skills'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.gitignore'), '.loom-backup/\n');

    const { default: doctor } = await import('../../src/commands/doctor.js');
    await doctor({ tool: 'claude-code' });
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('loom doctor');
    expect(output).toContain('.gitignore');
    consoleSpy.mockRestore();
  });

  it('reports no installation when no files exist', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { default: doctor } = await import('../../src/commands/doctor.js');
    await doctor({ tool: 'claude-code' });
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('No loom installation detected');
    consoleSpy.mockRestore();
  });
});
