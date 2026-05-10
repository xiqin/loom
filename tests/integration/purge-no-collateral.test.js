import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { install } from '../../src/core/installer.js';
import { uninstall } from '../../src/core/uninstaller.js';

const TEST_DIR = join(import.meta.dirname, '__test_purge__');

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  vi.spyOn(process, 'cwd').mockReturnValue(TEST_DIR);
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('purge no collateral damage', () => {
  it('purge removes backup directory', async () => {
    // Create a conflicting file, then force install (creates backup)
    mkdirSync(join(TEST_DIR, '.claude'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'), 'old content');
    await install({ tool: 'claude-code', force: true });
    expect(existsSync(join(TEST_DIR, '.loom-backup'))).toBe(true);

    await uninstall({ tool: 'claude-code', purge: true });
    expect(existsSync(join(TEST_DIR, '.loom-backup'))).toBe(false);
  });

  it('purge cleans .gitignore loom entries', async () => {
    await install({ tool: 'cursor' });
    const gitignorePath = join(TEST_DIR, '.gitignore');
    expect(existsSync(gitignorePath)).toBe(true);

    // Add user content to .gitignore
    const original = readFileSync(gitignorePath, 'utf-8');
    writeFileSync(gitignorePath, original + '\n# user stuff\nnode_modules/\n');

    await uninstall({ tool: 'cursor', purge: true });

    const after = readFileSync(gitignorePath, 'utf-8');
    expect(after).not.toContain('.loom-backup/');
    expect(after).toContain('node_modules/'); // user content preserved
  });

  it('purge does NOT delete user-created files', async () => {
    await install({ tool: 'cursor' });

    // Create user files that are NOT in manifest
    writeFileSync(join(TEST_DIR, 'my-config.json'), '{"user": true}');
    mkdirSync(join(TEST_DIR, 'src'), { recursive: true });
    writeFileSync(join(TEST_DIR, 'src', 'main.js'), 'console.log("user code")');

    await uninstall({ tool: 'cursor', purge: true });

    // User files must survive
    expect(existsSync(join(TEST_DIR, 'my-config.json'))).toBe(true);
    expect(existsSync(join(TEST_DIR, 'src', 'main.js'))).toBe(true);
  });

  it('purge preserves non-manifest .loom/ content (memory/, rules/)', async () => {
    await install({ tool: 'claude-code' });

    // Create non-manifest content under .loom/
    mkdirSync(join(TEST_DIR, '.loom', 'memory'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.loom', 'memory', 'constitution.md'), '# Constitution');
    mkdirSync(join(TEST_DIR, '.loom', 'rules'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.loom', 'rules', 'project-structure.md'), '# Rules');
    // Also create some other user file under .loom/ not in manifest
    mkdirSync(join(TEST_DIR, '.loom', 'notes'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.loom', 'notes', 'devlog.md'), '# Dev log');

    await uninstall({ tool: 'claude-code', purge: true });

    // .loom/memory/ and .loom/rules/ must survive purge
    expect(existsSync(join(TEST_DIR, '.loom', 'memory', 'constitution.md'))).toBe(true);
    expect(existsSync(join(TEST_DIR, '.loom', 'rules', 'project-structure.md'))).toBe(true);
    // Other user-created content under .loom/ also survives
    expect(existsSync(join(TEST_DIR, '.loom', 'notes', 'devlog.md'))).toBe(true);
  });

  it('normal uninstall also preserves non-manifest .loom/ content', async () => {
    await install({ tool: 'claude-code' });

    mkdirSync(join(TEST_DIR, '.loom', 'memory'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.loom', 'memory', 'constitution.md'), '# Constitution');
    mkdirSync(join(TEST_DIR, '.loom', 'rules'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.loom', 'rules', 'project-structure.md'), '# Rules');

    await uninstall({ tool: 'claude-code' }); // no purge

    expect(existsSync(join(TEST_DIR, '.loom', 'memory', 'constitution.md'))).toBe(true);
    expect(existsSync(join(TEST_DIR, '.loom', 'rules', 'project-structure.md'))).toBe(true);
  });

  it('normal uninstall keeps .loom-backup/', async () => {
    mkdirSync(join(TEST_DIR, '.claude'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'), 'old');
    await install({ tool: 'claude-code', force: true });
    expect(existsSync(join(TEST_DIR, '.loom-backup'))).toBe(true);

    await uninstall({ tool: 'claude-code' }); // no purge
    expect(existsSync(join(TEST_DIR, '.loom-backup'))).toBe(true);
  });

  it('purge without backup directory does not error', async () => {
    await install({ tool: 'cursor' });
    // No backup exists (no --force was used)
    const result = await uninstall({ tool: 'cursor', purge: true });
    expect(result).not.toBeNull();
    expect(result.purgedBackup).toBe(false);
  });
});
