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
  it('reports healthy when files exist with current version', async () => {
    writeFileSync(join(TEST_DIR, 'CLAUDE.md'), '<!-- rss:version=1.0.0 -->\ncontent');
    mkdirSync(join(TEST_DIR, '.rss', 'skills'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.gitignore'), '.rss-backup/\n');

    const { default: doctor } = await import('../../src/commands/doctor.js');
    await doctor({ tool: 'claude-code' });
  });

  it('reports missing files', async () => {
    const { default: doctor } = await import('../../src/commands/doctor.js');
    await doctor({ tool: 'claude-code' });
  });
});
