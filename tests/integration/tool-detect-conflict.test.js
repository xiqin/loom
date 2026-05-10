import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, readFileSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { install } from '../../src/core/installer.js';
import { detectInstalledTool } from '../../src/core/installer.js';

const TEST_DIR = join(import.meta.dirname, '__test_tool_detect__');

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  vi.spyOn(process, 'cwd').mockReturnValue(TEST_DIR);
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('tool auto-detect and conflict', () => {
  it('detectInstalledTool returns null when nothing installed', () => {
    expect(detectInstalledTool(TEST_DIR)).toBeNull();
  });

  it('detectInstalledTool finds claude-code', async () => {
    await install({ tool: 'claude-code' });
    expect(detectInstalledTool(TEST_DIR)).toBe('claude-code');
  });

  it('detectInstalledTool finds cursor', async () => {
    await install({ tool: 'cursor' });
    expect(detectInstalledTool(TEST_DIR)).toBe('cursor');
  });

  it('detectInstalledTool finds copilot', async () => {
    await install({ tool: 'copilot' });
    expect(detectInstalledTool(TEST_DIR)).toBe('copilot');
  });

  it('detectInstalledTool finds opencode', async () => {
    await install({ tool: 'opencode' });
    expect(detectInstalledTool(TEST_DIR)).toBe('opencode');
  });

  it('non-loom entry file is not detected', () => {
    writeFileSync(join(TEST_DIR, 'CLAUDE.md'), '# Not loom managed');
    expect(detectInstalledTool(TEST_DIR)).toBeNull();
  });

  it('install with one tool then force-install another works', async () => {
    await install({ tool: 'cursor' });
    expect(detectInstalledTool(TEST_DIR)).toBe('cursor');

    // Force install claude-code over cursor
    await install({ tool: 'claude-code', force: true });
    expect(existsSync(join(TEST_DIR, 'CLAUDE.md'))).toBe(true);
  });

  it('init without force on existing different entry file detects conflict', async () => {
    // Write a non-loom CLAUDE.md
    writeFileSync(join(TEST_DIR, 'CLAUDE.md'), '# My custom CLAUDE.md');
    // init should detect conflict and return null (no force)
    const result = await install({ tool: 'claude-code' });
    expect(result).toBeNull();
    // Original content preserved
    expect(readFileSync(join(TEST_DIR, 'CLAUDE.md'), 'utf-8')).toBe('# My custom CLAUDE.md');
  });
});
