import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, readFileSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { install } from '../../src/core/installer.js';
import { uninstall } from '../../src/core/uninstaller.js';

const TEST_DIR = join(import.meta.dirname, '__test_safe_delete__');

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  vi.spyOn(process, 'cwd').mockReturnValue(TEST_DIR);
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('uninstall safe delete', () => {
  it('deletes unmodified files', async () => {
    await install({ tool: 'cursor' });
    expect(existsSync(join(TEST_DIR, '.cursorrules'))).toBe(true);

    const result = await uninstall({ tool: 'cursor' });
    expect(result).not.toBeNull();
    expect(result.deleted).toBeGreaterThan(0);
    expect(existsSync(join(TEST_DIR, '.cursorrules'))).toBe(false);
  });

  it('skips modified files in non-interactive mode', async () => {
    await install({ tool: 'cursor' });
    // Modify entry file
    writeFileSync(join(TEST_DIR, '.cursorrules'), 'user modified content');

    const result = await uninstall({ tool: 'cursor' });
    expect(result.skipped).toBeGreaterThan(0);
    // Modified file should still exist (prompt defaults to no in non-TTY)
    expect(existsSync(join(TEST_DIR, '.cursorrules'))).toBe(true);
    expect(readFileSync(join(TEST_DIR, '.cursorrules'), 'utf-8')).toBe('user modified content');
  });

  it('removes manifest after uninstall', async () => {
    await install({ tool: 'cursor' });
    await uninstall({ tool: 'cursor' });
    expect(existsSync(join(TEST_DIR, '.loom', 'install-manifest.json'))).toBe(false);
  });

  it('handles missing manifest gracefully', async () => {
    const result = await uninstall({ tool: 'cursor' });
    expect(result).toBeNull();
  });

  it('rejects mismatched tool in manifest', async () => {
    await install({ tool: 'cursor' });
    const result = await uninstall({ tool: 'claude-code' });
    expect(result).toBeNull();
  });

  it('classifies already-deleted files as missing', async () => {
    await install({ tool: 'claude-code' });
    // claude-code creates .loom/skills/ which is tracked in manifest
    // Delete a file that's in the manifest checksums
    const manifest = readFileSync(join(TEST_DIR, '.loom', 'install-manifest-claude-code.json'), 'utf-8');
    const manifestData = JSON.parse(manifest);
    const checksumFiles = Object.keys(manifestData.fileChecksums);
    expect(checksumFiles.length).toBeGreaterThan(0);

    // Delete one of the checksummed files
    const fileToDelete = join(TEST_DIR, checksumFiles[0]);
    if (existsSync(fileToDelete)) {
      rmSync(fileToDelete, { force: true });
    }

    const result = await uninstall({ tool: 'claude-code' });
    expect(result.missing).toBeGreaterThan(0);
  });

  it('dry run does not delete files', async () => {
    await install({ tool: 'cursor' });
    const result = await uninstall({ tool: 'cursor', dryRun: true });
    expect(result).toBeNull();
    expect(existsSync(join(TEST_DIR, '.cursorrules'))).toBe(true);
  });
});
