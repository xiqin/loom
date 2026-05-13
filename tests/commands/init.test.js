import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, readFileSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const TEST_DIR = join(import.meta.dirname, '__test_install__');

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('install command', () => {
  it('calls adapter.install for valid tool', async () => {
    const log = [];
    const mockAdapter = {
      toolName: 'claude-code',
      getUserDir: () => join(TEST_DIR, '.claude'),
      getSkillsDir: () => join(TEST_DIR, '.claude', 'skills'),
      getCommandsDir: () => null,
      supportsPlugin: () => false,
      install: vi.fn(() => ['  skills: 0 copied']),
    };

    vi.doMock('../../src/core/installer.js', () => ({
      getUserAdapter: async () => mockAdapter,
      USER_TOOL_IDS: ['claude-code', 'cursor', 'copilot', 'opencode', 'codex'],
    }));

    const sp = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { default: install } = await import('../../src/commands/install.js');
    await install({ tool: 'claude-code' });
    expect(mockAdapter.install).toHaveBeenCalled();
    sp.mockRestore();
  });

  it('prints unknown tool for invalid tool', async () => {
    vi.doMock('../../src/core/installer.js', () => ({
      getUserAdapter: async () => { throw new Error('Unknown tool'); },
      USER_TOOL_IDS: ['claude-code', 'cursor', 'copilot', 'opencode', 'codex'],
    }));

    const sp = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { default: install } = await import('../../src/commands/install.js');
    await install({ tool: 'unknown' });
    const output = sp.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Unknown tool');
    sp.mockRestore();
  });

  it('dry-run shows paths without installing', async () => {
    const mockAdapter = {
      toolName: 'cursor',
      getUserDir: () => join(TEST_DIR, '.cursor'),
      getRulesDir: () => join(TEST_DIR, '.cursor', 'rules'),
      getSkillsDir: () => join(TEST_DIR, '.cursor', 'skills'),
      getCommandsDir: () => join(TEST_DIR, '.cursor', 'commands'),
      supportsPlugin: () => false,
      install: vi.fn(),
    };

    vi.doMock('../../src/core/installer.js', () => ({
      getUserAdapter: async () => mockAdapter,
      USER_TOOL_IDS: ['claude-code', 'cursor', 'copilot', 'opencode', 'codex'],
    }));

    const sp = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { default: install } = await import('../../src/commands/install.js');
    await install({ tool: 'cursor', dryRun: true });
    expect(mockAdapter.install).not.toHaveBeenCalled();
    const output = sp.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('dry-run');
    sp.mockRestore();
  });
});
