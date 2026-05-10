import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, readFileSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { install } from '../../src/core/installer.js';
import { uninstall } from '../../src/core/uninstaller.js';
import { readManifest } from '../../src/core/manifest.js';

const TEST_DIR = join(import.meta.dirname, '__test_lifecycle__');

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  vi.spyOn(process, 'cwd').mockReturnValue(TEST_DIR);
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('e2e lifecycle: install → update → uninstall', () => {
  const tools = ['cursor', 'copilot'];

  for (const tool of tools) {
    describe(tool, () => {
      it('full lifecycle', async () => {
        // ── Install ──
        const m1 = await install({ tool, version: '1.0.0' });
        expect(m1).not.toBeNull();
        expect(m1.version).toBe('1.0.0');
        expect(m1.tool).toBe(tool);

        // Verify manifest exists
        const manifest1 = readManifest(TEST_DIR, tool);
        expect(manifest1).not.toBeNull();
        expect(manifest1.fileChecksums).toBeDefined();
        expect(Object.keys(manifest1.fileChecksums).length).toBeGreaterThan(0);

        // ── Idempotent install ──
        const m1b = await install({ tool, version: '1.0.0' });
        expect(m1b).toBeNull(); // no-op

        // ── Update ──
        const m2 = await install({ tool, version: '2.0.0', update: true });
        expect(m2).not.toBeNull();
        expect(m2.version).toBe('2.0.0');

        // Verify manifest updated
        const manifest2 = readManifest(TEST_DIR, tool);
        expect(manifest2.version).toBe('2.0.0');

        // ── Idempotent update ──
        const m2b = await install({ tool, version: '2.0.0', update: true });
        expect(m2b).toBeNull(); // no-op

        // ── Uninstall ──
        const result = await uninstall({ tool });
        expect(result).not.toBeNull();
        expect(result.deleted).toBeGreaterThan(0);
        expect(result.skipped).toBe(0); // no modifications

        // Verify cleanup
        expect(existsSync(join(TEST_DIR, '.loom', 'install-manifest.json'))).toBe(false);
      });
    });
  }

  it('lifecycle with user modification preserved', async () => {
    const tool = 'cursor';
    await install({ tool, version: '1.0.0' });

    // User modifies entry file
    const entryPath = join(TEST_DIR, '.cursorrules');
    const original = readFileSync(entryPath, 'utf-8');
    writeFileSync(entryPath, original + '\n# My custom rules');

    // Uninstall should skip modified file
    const result = await uninstall({ tool });
    expect(result.skipped).toBeGreaterThan(0);
    expect(existsSync(entryPath)).toBe(true);
    expect(readFileSync(entryPath, 'utf-8')).toContain('# My custom rules');
  });

  it('lifecycle with force reinstall and backup', async () => {
    const tool = 'claude-code';

    // Write a non-loom conflicting file, then force install creates backup
    const entryDir = join(TEST_DIR, '.claude');
    mkdirSync(entryDir, { recursive: true });
    writeFileSync(join(entryDir, 'CLAUDE.md'), 'non-loom content');
    const m2 = await install({ tool, version: '1.0.0', force: true });
    expect(m2).not.toBeNull();
    expect(existsSync(join(TEST_DIR, '.loom-backup'))).toBe(true);

    // Uninstall with purge
    const result = await uninstall({ tool, purge: true });
    expect(result).not.toBeNull();
    expect(existsSync(join(TEST_DIR, '.loom-backup'))).toBe(false);
  });
});

describe('e2e lifecycle: claude-code with .claude/ wrappers', () => {
  it('install and uninstall claude-code', async () => {
    const tool = 'claude-code';
    const m = await install({ tool });
    expect(m).not.toBeNull();

    // Verify .claude/ structure (no root-level files, no .claude-plugin/)
    expect(existsSync(join(TEST_DIR, '.claude', 'CLAUDE.md'))).toBe(true);
    expect(existsSync(join(TEST_DIR, '.claude', 'skills', 'brainstorming', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(TEST_DIR, '.claude', 'commands', 'loom-init-project.md'))).toBe(true);
    expect(existsSync(join(TEST_DIR, 'CLAUDE.md'))).toBe(false);
    expect(existsSync(join(TEST_DIR, '.claude-plugin'))).toBe(false);
    expect(existsSync(join(TEST_DIR, 'skills'))).toBe(false);
    expect(existsSync(join(TEST_DIR, 'commands'))).toBe(false);

    const result = await uninstall({ tool });
    expect(result).not.toBeNull();
    expect(existsSync(join(TEST_DIR, '.claude', 'CLAUDE.md'))).toBe(false);
  });
});

describe('e2e lifecycle: opencode with wrapper paths', () => {
  it('install and uninstall opencode', async () => {
    const tool = 'opencode';
    const m = await install({ tool });
    expect(m).not.toBeNull();

    // Verify structure: .loom/ is single source of truth, .opencode/ has thin wrappers
    expect(existsSync(join(TEST_DIR, 'AGENTS.md'))).toBe(true);
    expect(existsSync(join(TEST_DIR, '.loom', 'skills'))).toBe(true);
    expect(existsSync(join(TEST_DIR, '.opencode', 'skills'))).toBe(true);
    expect(existsSync(join(TEST_DIR, '.opencode', 'commands'))).toBe(true);
    expect(existsSync(join(TEST_DIR, '.opencode', 'agents'))).toBe(false);
    expect(existsSync(join(TEST_DIR, '.claude'))).toBe(false);

    const result = await uninstall({ tool });
    expect(result).not.toBeNull();
    expect(existsSync(join(TEST_DIR, 'AGENTS.md'))).toBe(false);
  });
});
