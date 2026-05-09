import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { CopilotAdapter } from '../../src/adapters/copilot.js';

const TEST_DIR = join(import.meta.dirname, '__test_copilot__');

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('CopilotAdapter', () => {
  const adapter = new CopilotAdapter();

  it('has name "copilot"', () => {
    expect(adapter.name).toBe('copilot');
  });

  it('has entryFilename .github/copilot-instructions.md', () => {
    expect(adapter.entryFilename).toBe('.github/copilot-instructions.md');
  });

  it('getTargetFiles returns copilot-instructions.md path', () => {
    const files = adapter.getTargetFiles(TEST_DIR);
    expect(files).toEqual([join(TEST_DIR, '.github', 'copilot-instructions.md')]);
  });

  it('generate creates .github/copilot-instructions.md', async () => {
    await adapter.generate(TEST_DIR, '1.0.0');
    expect(existsSync(join(TEST_DIR, '.github', 'copilot-instructions.md'))).toBe(true);
  });

  it('generated file contains version marker', async () => {
    await adapter.generate(TEST_DIR, '1.0.0');
    const content = readFileSync(join(TEST_DIR, '.github', 'copilot-instructions.md'), 'utf-8');
    expect(content).toContain('# rss:version=1.0.0');
  });

  it('generated file contains pipeline steps', async () => {
    await adapter.generate(TEST_DIR, '1.0.0');
    const content = readFileSync(join(TEST_DIR, '.github', 'copilot-instructions.md'), 'utf-8');
    expect(content).toContain('brainstorming');
    expect(content).toContain('writing-plans');
    expect(content).toContain('subagent-dev');
  });

  it('generated file contains USER CUSTOM section', async () => {
    await adapter.generate(TEST_DIR, '1.0.0');
    const content = readFileSync(join(TEST_DIR, '.github', 'copilot-instructions.md'), 'utf-8');
    expect(content).toContain('USER CUSTOM');
  });
});
