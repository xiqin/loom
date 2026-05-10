import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { detectConflicts, ensureGitignore } from '../../src/utils/conflict.js';

const TEST_DIR = join(import.meta.dirname, '__test_conflict__');

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('detectConflicts', () => {
  it('returns empty when no files exist', () => {
    const targets = [join(TEST_DIR, 'new-file.md')];
    expect(detectConflicts(targets)).toEqual([]);
  });

  it('detects files without loom version marker', () => {
    const file = join(TEST_DIR, 'existing.md');
    writeFileSync(file, 'user content');
    const result = detectConflicts([file]);
    expect(result).toEqual([
      { file, status: 'conflict', reason: 'File exists without loom version marker' }
    ]);
  });

  it('detects files with loom version marker', () => {
    const file = join(TEST_DIR, 'loom-managed.md');
    writeFileSync(file, '<!-- loom:version=1.0.0 -->\ncontent');
    const result = detectConflicts([file]);
    expect(result).toEqual([
      { file, status: 'loom-managed', version: '1.0.0' }
    ]);
  });
});

describe('ensureGitignore', () => {
  it('creates .gitignore with loom-backup entry', () => {
    ensureGitignore(TEST_DIR);
    const content = readFileSync(join(TEST_DIR, '.gitignore'), 'utf-8');
    expect(content).toContain('.loom-backup/');
  });

  it('appends to existing .gitignore', () => {
    writeFileSync(join(TEST_DIR, '.gitignore'), 'node_modules/\n');
    ensureGitignore(TEST_DIR);
    const content = readFileSync(join(TEST_DIR, '.gitignore'), 'utf-8');
    expect(content).toContain('node_modules/');
    expect(content).toContain('.loom-backup/');
  });

  it('does not duplicate loom-backup entry', () => {
    writeFileSync(join(TEST_DIR, '.gitignore'), '.loom-backup/\n');
    ensureGitignore(TEST_DIR);
    const content = readFileSync(join(TEST_DIR, '.gitignore'), 'utf-8');
    const matches = content.match(/\.loom-backup\//g);
    expect(matches.length).toBe(1);
  });
});
