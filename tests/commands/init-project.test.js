import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let TEST_DIR;

beforeEach(() => {
  TEST_DIR = mkdtempSync(join(tmpdir(), 'loom-init-project-command-'));
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('init-project command', () => {
  it('initializes project context through the public loom CLI command', async () => {
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({
      name: 'demo-app',
      scripts: { test: 'vitest run' },
    }));

    const sp = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { default: initProjectCommand } = await import('../../src/commands/init-project.js');
    await initProjectCommand({ cwd: TEST_DIR, tools: 'codex', codegraph: false });

    expect(existsSync(join(TEST_DIR, 'AGENTS.md'))).toBe(true);
    expect(existsSync(join(TEST_DIR, '.loom', 'rules', 'constitution.md'))).toBe(true);
    expect(readFileSync(join(TEST_DIR, 'AGENTS.md'), 'utf8')).toContain('.loom/rules/constitution.md');

    const output = sp.mock.calls.map(call => call[0]).join('\n');
    expect(output).toContain('loom init-project');
    expect(output).toContain('demo-app');
    sp.mockRestore();
  });

  it('accepts Claude Code as a public init-project tool id', async () => {
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({
      name: 'demo-app',
    }));

    const sp = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { default: initProjectCommand } = await import('../../src/commands/init-project.js');
    await initProjectCommand({ cwd: TEST_DIR, tools: 'claude-code', interactive: false, codegraph: false });

    expect(existsSync(join(TEST_DIR, 'AGENTS.md'))).toBe(true);
    expect(existsSync(join(TEST_DIR, 'CLAUDE.md'))).toBe(true);
    expect(readFileSync(join(TEST_DIR, 'CLAUDE.md'), 'utf8')).toBe('@AGENTS.md\n');
    expect(existsSync(join(TEST_DIR, '.claudeignore'))).toBe(true);

    const output = sp.mock.calls.map(call => call[0]).join('\n');
    expect(output).toContain('claude-code');
    sp.mockRestore();
  });
});
