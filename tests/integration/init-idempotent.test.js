import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { install } from '../../src/core/installer.js';
import { readManifest } from '../../src/core/manifest.js';

const TEST_DIR = join(import.meta.dirname, '__test_idempotent_init__');

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  vi.spyOn(process, 'cwd').mockReturnValue(TEST_DIR);
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('init idempotency', () => {
  it('first install creates manifest', async () => {
    const m1 = await install({ tool: 'cursor' });
    expect(m1).not.toBeNull();
    expect(m1.version).toBeDefined();
    expect(m1.tool).toBe('cursor');
    expect(existsSync(join(TEST_DIR, '.cursorrules'))).toBe(true);
    expect(existsSync(join(TEST_DIR, '.loom', 'install-manifest.json'))).toBe(true);
  });

  it('second install with same version is no-op (returns null)', async () => {
    await install({ tool: 'cursor' });
    const m2 = await install({ tool: 'cursor' });
    expect(m2).toBeNull();
  });

  it('manifest does not change on second install', async () => {
    await install({ tool: 'cursor' });
    const manifest1 = readManifest(TEST_DIR);

    await install({ tool: 'cursor', force: true });
    const manifest2 = readManifest(TEST_DIR);

    expect(manifest2.version).toBe(manifest1.version);
    expect(manifest2.tool).toBe(manifest1.tool);
  });

  it('entry file content is stable across installs', async () => {
    await install({ tool: 'claude-code' });
    const content1 = readFileSync(join(TEST_DIR, 'CLAUDE.md'), 'utf-8');

    await install({ tool: 'claude-code', force: true });
    const content2 = readFileSync(join(TEST_DIR, 'CLAUDE.md'), 'utf-8');

    expect(content2).toBe(content1);
  });

  it('skills directory is stable across installs (claude-code)', async () => {
    await install({ tool: 'claude-code' });
    const { readdirSync } = await import('node:fs');
    const skillsDir = join(TEST_DIR, '.loom', 'skills');
    expect(existsSync(skillsDir)).toBe(true);
    const skills1 = readdirSync(skillsDir, { recursive: true }).sort();

    await install({ tool: 'claude-code', force: true });
    const skills2 = readdirSync(skillsDir, { recursive: true }).sort();

    expect(skills2).toEqual(skills1);
  });
});
