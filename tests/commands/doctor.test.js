import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const TEST_DIR = join(import.meta.dirname, '__test_doctor__');

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('doctor command', () => {
  it('reports no installation when no skills exist', async () => {
    const mockAdapter = {
      toolName: 'claude-code',
      getUserDir: () => join(TEST_DIR, '.claude'),
      getSkillsDir: () => join(TEST_DIR, '.claude', 'skills'),
      getCommandsDir: () => null,
      supportsPlugin: () => false,
    };

    vi.doMock('../../src/core/installer.js', () => ({
      getUserAdapter: async () => mockAdapter,
      USER_TOOL_IDS: ['claude-code'],
    }));

    const sp = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { default: doctor } = await import('../../src/commands/doctor.js');
    await doctor({ tool: 'claude-code' });
    const output = sp.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('No loom installation detected');
    sp.mockRestore();
  });

  it('reports skills when they exist', async () => {
    const skillsDir = join(TEST_DIR, '.claude', 'skills', 'test-skill');
    mkdirSync(skillsDir, { recursive: true });
    writeFileSync(join(skillsDir, 'SKILL.md'), '# Test');

    const mockAdapter = {
      toolName: 'claude-code',
      getUserDir: () => join(TEST_DIR, '.claude'),
      getSkillsDir: () => join(TEST_DIR, '.claude', 'skills'),
      getCommandsDir: () => null,
      supportsPlugin: () => false,
    };

    vi.doMock('../../src/core/installer.js', () => ({
      getUserAdapter: async () => mockAdapter,
      USER_TOOL_IDS: ['claude-code'],
    }));

    const sp = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { default: doctor } = await import('../../src/commands/doctor.js');
    await doctor({ tool: 'claude-code' });
    const output = sp.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('loom doctor');
    expect(output).toContain('1 skill(s)');
    sp.mockRestore();
  });
});
