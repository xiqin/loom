import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, readFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { OpenCodeAdapter } from '../../src/adapters/opencode.js';

const TEST_DIR = join(import.meta.dirname, '__test_opencode__');

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(async () => {
  for (let i = 0; i < 3; i++) {
    try {
      rmSync(TEST_DIR, { recursive: true, force: true });
      return;
    } catch (e) {
      if (e.code === 'EBUSY' && i < 2) {
        await new Promise(r => setTimeout(r, 100));
      } else if (i === 2) {
      } else {
        throw e;
      }
    }
  }
});

describe('OpenCodeAdapter', () => {
  const adapter = new OpenCodeAdapter();

  it('has name "opencode"', () => {
    expect(adapter.name).toBe('opencode');
  });

  it('has entryFilename AGENTS.md', () => {
    expect(adapter.entryFilename).toBe('AGENTS.md');
  });

  it('getTargetFiles returns .opencode/skills/ not .opencode/agents/', () => {
    const files = adapter.getTargetFiles(TEST_DIR);
    expect(files).toContainEqual(expect.stringContaining('.loom'));
    expect(files).toContainEqual(expect.stringContaining('.opencode'));
    expect(files).toContainEqual(expect.stringContaining('AGENTS.md'));
    expect(files.some(f => f.includes('.opencode') && f.includes('skills'))).toBe(true);
    expect(files.some(f => f.includes('.opencode') && f.includes('agents'))).toBe(false);
  });

  it('getTargetFiles does NOT include .claude/ paths', () => {
    const files = adapter.getTargetFiles(TEST_DIR);
    expect(files.some(f => f.includes('.claude'))).toBe(false);
  });

  it('generate creates AGENTS.md with version marker', async () => {
    await adapter.generate(TEST_DIR, '1.0.0');
    const content = readFileSync(join(TEST_DIR, 'AGENTS.md'), 'utf-8');
    expect(content).toContain('<!-- loom:version=1.0.0 -->');
    expect(content).toContain('loom — Weave Specs into Execution');
  });

  it('generate does NOT create root-level skills/ or commands/', async () => {
    await adapter.generate(TEST_DIR, '1.0.0');
    expect(existsSync(join(TEST_DIR, 'skills'))).toBe(false);
    expect(existsSync(join(TEST_DIR, 'commands'))).toBe(false);
  });

  it('generate does NOT create .claude/', async () => {
    await adapter.generate(TEST_DIR, '1.0.0');
    expect(existsSync(join(TEST_DIR, '.claude'))).toBe(false);
  });

  it('generate copies skills to .loom/', async () => {
    await adapter.generate(TEST_DIR, '1.0.0');
    expect(existsSync(join(TEST_DIR, '.loom', 'skills'))).toBe(true);
  });

  it('generate creates skill wrappers in .opencode/skills/ (not agents/)', async () => {
    await adapter.generate(TEST_DIR, '1.0.0');
    expect(existsSync(join(TEST_DIR, '.opencode', 'skills'))).toBe(true);
    expect(existsSync(join(TEST_DIR, '.opencode', 'agents'))).toBe(false);
    const wrapperPath = join(TEST_DIR, '.opencode', 'skills', 'brainstorming.md');
    expect(existsSync(wrapperPath)).toBe(true);
    const wrapper = readFileSync(wrapperPath, 'utf-8');
    expect(wrapper).toContain('@.loom/skills/brainstorming/SKILL.md');
    expect(wrapper).toContain('name: brainstorming');
  });

  it('generate creates command wrappers in .opencode/commands/', async () => {
    await adapter.generate(TEST_DIR, '1.0.0');
    const wrapperPath = join(TEST_DIR, '.opencode', 'commands', 'loom-init-project.md');
    expect(existsSync(wrapperPath)).toBe(true);
    const wrapper = readFileSync(wrapperPath, 'utf-8');
    expect(wrapper).toContain('@.loom/commands/loom-init-project.md');
  });

  it('generate copies hooks, templates, core to .loom/', async () => {
    await adapter.generate(TEST_DIR, '1.0.0');
    expect(existsSync(join(TEST_DIR, '.loom', 'hooks'))).toBe(true);
    expect(existsSync(join(TEST_DIR, '.loom', 'templates'))).toBe(true);
    expect(existsSync(join(TEST_DIR, '.loom', 'core'))).toBe(true);
  });

  it('generateWrappers resyncs .opencode/ from existing .loom/', async () => {
    await adapter.generate(TEST_DIR, '1.0.0');
    expect(existsSync(join(TEST_DIR, '.opencode', 'skills', 'brainstorming.md'))).toBe(true);

    adapter.generateWrappers(TEST_DIR, '2.0.0');
    const opencodeMd = readFileSync(join(TEST_DIR, 'AGENTS.md'), 'utf-8');
    expect(opencodeMd).toContain('<!-- loom:version=2.0.0 -->');
  });
});
