import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, readFileSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { install } from '../../src/core/installer.js';
import { readManifest } from '../../src/core/manifest.js';

const TEST_DIR = join(import.meta.dirname, '__test_idempotent_update__');

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  vi.spyOn(process, 'cwd').mockReturnValue(TEST_DIR);
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('update idempotency', () => {
  it('install then update with same version is no-op', async () => {
    await install({ tool: 'cursor' });
    const m = await install({ tool: 'cursor', update: true });
    expect(m).toBeNull();
  });

  it('update with forced higher version succeeds', async () => {
    await install({ tool: 'cursor', version: '0.9.0' });
    const m = await install({ tool: 'cursor', update: true, version: '1.0.0' });
    expect(m).not.toBeNull();
    expect(m.version).toBe('1.0.0');
  });

  it('update entry file contains new version marker', async () => {
    await install({ tool: 'cursor', version: '0.9.0' });
    await install({ tool: 'cursor', update: true, version: '1.0.0' });
    const content = readFileSync(join(TEST_DIR, '.cursorrules'), 'utf-8');
    expect(content).toContain('loom:version=1.0.0');
  });

  it('second update with same new version is no-op', async () => {
    await install({ tool: 'cursor', version: '0.9.0' });
    await install({ tool: 'cursor', update: true, version: '1.0.0' });
    const m2 = await install({ tool: 'cursor', update: true, version: '1.0.0' });
    expect(m2).toBeNull();
  });

  it('manifest version updates correctly', async () => {
    await install({ tool: 'cursor', version: '0.9.0' });
    const m1 = readManifest(TEST_DIR);
    expect(m1.version).toBe('0.9.0');

    await install({ tool: 'cursor', update: true, version: '2.0.0' });
    const m2 = readManifest(TEST_DIR);
    expect(m2.version).toBe('2.0.0');
  });
});
