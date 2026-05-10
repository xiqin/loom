import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { CursorAdapter } from '../../src/adapters/cursor.js';

const TEST_DIR = join(import.meta.dirname, '__test_cursor__');

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('CursorAdapter', () => {
  const adapter = new CursorAdapter();

  it('has name "cursor"', () => {
    expect(adapter.name).toBe('cursor');
  });

  it('has entryFilename .cursorrules', () => {
    expect(adapter.entryFilename).toBe('.cursorrules');
  });

  it('getTargetFiles returns .cursorrules and .loom/ paths', () => {
    const files = adapter.getTargetFiles(TEST_DIR);
    expect(files).toContain(join(TEST_DIR, '.cursorrules'));
    expect(files).toContain(join(TEST_DIR, '.loom', 'skills'));
    expect(files).toContain(join(TEST_DIR, '.loom', 'core'));
  });

  it('generate creates .cursorrules file', async () => {
    await adapter.generate(TEST_DIR, '1.0.0');
    expect(existsSync(join(TEST_DIR, '.cursorrules'))).toBe(true);
  });

  it('generated file contains version marker', async () => {
    await adapter.generate(TEST_DIR, '1.0.0');
    const content = readFileSync(join(TEST_DIR, '.cursorrules'), 'utf-8');
    expect(content).toContain('<!-- loom:version=1.0.0 -->');
  });

  it('generated file contains pipeline definition', async () => {
    await adapter.generate(TEST_DIR, '1.0.0');
    const content = readFileSync(join(TEST_DIR, '.cursorrules'), 'utf-8');
    expect(content).toContain('brainstorming');
    expect(content).toContain('writing-plans');
  });

  it('generated file contains Skills section', async () => {
    await adapter.generate(TEST_DIR, '1.0.0');
    const content = readFileSync(join(TEST_DIR, '.cursorrules'), 'utf-8');
    expect(content).toContain('Skills 清单');
  });
});
