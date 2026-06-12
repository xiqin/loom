import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const TEST_DIR = join(import.meta.dirname, '__test_index_command__');
const spawnSync = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', () => ({ spawnSync }));

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  spawnSync.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('loom index — codegraph delegation', () => {
  it('delegates to "codegraph sync" when .codegraph/ exists', async () => {
    mkdirSync(join(TEST_DIR, '.codegraph'), { recursive: true });
    mkdirSync(join(TEST_DIR, '.loom'), { recursive: true });
    spawnSync.mockReturnValue({ status: 0 });
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const { default: indexCommand } = await import('../../src/commands/index.js');
    await indexCommand({ cwd: TEST_DIR });

    const call = spawnSync.mock.calls.find(c => c[0] === 'codegraph');
    expect(call).toBeTruthy();
    expect(call[1]).toEqual(['sync', TEST_DIR]);
  });

  it('--check delegates to "codegraph status" and propagates exit code', async () => {
    mkdirSync(join(TEST_DIR, '.codegraph'), { recursive: true });
    spawnSync.mockReturnValue({ status: 1 });
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const { default: indexCommand } = await import('../../src/commands/index.js');
    process.exitCode = 0;
    await indexCommand({ cwd: TEST_DIR, check: true });

    const call = spawnSync.mock.calls.find(c => c[0] === 'codegraph');
    expect(call[1]).toEqual(['status']);
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });

  it('--no-codegraph skips indexing even when .codegraph/ exists', async () => {
    mkdirSync(join(TEST_DIR, '.codegraph'), { recursive: true });
    mkdirSync(join(TEST_DIR, '.loom'), { recursive: true });
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const { default: indexCommand } = await import('../../src/commands/index.js');
    await indexCommand({ cwd: TEST_DIR, codegraph: false });

    expect(spawnSync).not.toHaveBeenCalled();
  });
});
