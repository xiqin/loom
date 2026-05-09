import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { OpenCodeAdapter } from '../../src/adapters/opencode.js';

const TEST_DIR = join(import.meta.dirname, '__test_opencode__');

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(async () => {
  // Windows may lock files briefly during coverage instrumentation
  for (let i = 0; i < 3; i++) {
    try {
      rmSync(TEST_DIR, { recursive: true, force: true });
      return;
    } catch (e) {
      if (e.code === 'EBUSY' && i < 2) {
        await new Promise(r => setTimeout(r, 100));
      } else if (i === 2) {
        // Last attempt — ignore
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

  it('getTargetFiles includes dual paths', () => {
    const files = adapter.getTargetFiles(TEST_DIR);
    expect(files).toContainEqual(expect.stringContaining('.rss'));
    expect(files).toContainEqual(expect.stringContaining('.opencode'));
    expect(files).toContainEqual(expect.stringContaining('AGENTS.md'));
  });

  it('generate creates AGENTS.md with version marker', async () => {
    await adapter.generate(TEST_DIR, '1.0.0');
    const content = readFileSync(join(TEST_DIR, 'AGENTS.md'), 'utf-8');
    expect(content).toContain('<!-- rss:version=1.0.0 -->');
    expect(content).toContain('Requirement-Driven Software Engineering');
  });

  it('generate copies skills to both .rss/ and .opencode/', async () => {
    await adapter.generate(TEST_DIR, '1.0.0');
    // .rss/skills should exist
    expect(existsSync(join(TEST_DIR, '.rss', 'skills'))).toBe(true);
    // .opencode/skills should exist
    expect(existsSync(join(TEST_DIR, '.opencode', 'skills'))).toBe(true);
  });

  it('generate copies commands to both .rss/ and .opencode/', async () => {
    await adapter.generate(TEST_DIR, '1.0.0');
    expect(existsSync(join(TEST_DIR, '.rss', 'commands'))).toBe(true);
    expect(existsSync(join(TEST_DIR, '.opencode', 'commands'))).toBe(true);
  });

  it('generate creates .opencode/plugin.json', async () => {
    await adapter.generate(TEST_DIR, '1.0.0');
    expect(existsSync(join(TEST_DIR, '.opencode', 'plugin.json'))).toBe(true);
  });

  it('generate copies hooks, templates, core to .rss/', async () => {
    await adapter.generate(TEST_DIR, '1.0.0');
    expect(existsSync(join(TEST_DIR, '.rss', 'hooks'))).toBe(true);
    expect(existsSync(join(TEST_DIR, '.rss', 'templates'))).toBe(true);
    expect(existsSync(join(TEST_DIR, '.rss', 'core'))).toBe(true);
  });
});
