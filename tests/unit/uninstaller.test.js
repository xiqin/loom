import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import {
  fileHash,
  expandFiles,
  buildChecksumMap,
  classifyFiles,
} from '../../src/core/uninstaller.js';

const TEST_DIR = join(import.meta.dirname, '__test_uninstaller__');

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('fileHash', () => {
  it('returns sha256 hex digest of file', () => {
    const content = 'hello world';
    writeFileSync(join(TEST_DIR, 'test.txt'), content);
    const hash = fileHash(join(TEST_DIR, 'test.txt'));
    expect(hash).toBe(sha256(content));
  });

  it('returns null for nonexistent file', () => {
    expect(fileHash(join(TEST_DIR, 'nope.txt'))).toBeNull();
  });
});

describe('expandFiles', () => {
  it('returns files from directory recursively', () => {
    mkdirSync(join(TEST_DIR, 'sub'), { recursive: true });
    writeFileSync(join(TEST_DIR, 'a.txt'), 'a');
    writeFileSync(join(TEST_DIR, 'sub', 'b.txt'), 'b');
    const expanded = expandFiles([join(TEST_DIR, 'sub')]);
    expect(expanded).toHaveLength(1);
    expect(expanded[0]).toContain('b.txt');
  });

  it('passes through individual files', () => {
    writeFileSync(join(TEST_DIR, 'a.txt'), 'a');
    const expanded = expandFiles([join(TEST_DIR, 'a.txt')]);
    expect(expanded).toEqual([join(TEST_DIR, 'a.txt')]);
  });

  it('skips nonexistent paths', () => {
    const expanded = expandFiles([join(TEST_DIR, 'ghost.txt')]);
    expect(expanded).toEqual([]);
  });
});

describe('buildChecksumMap', () => {
  it('builds relative-path to hash map', () => {
    writeFileSync(join(TEST_DIR, 'a.txt'), 'content-a');
    mkdirSync(join(TEST_DIR, 'sub'), { recursive: true });
    writeFileSync(join(TEST_DIR, 'sub', 'b.txt'), 'content-b');
    const map = buildChecksumMap(TEST_DIR, [join(TEST_DIR, 'a.txt'), join(TEST_DIR, 'sub')]);
    expect(map['a.txt']).toBe(sha256('content-a'));
    expect(map[join('sub', 'b.txt')]).toBe(sha256('content-b'));
  });
});

describe('classifyFiles', () => {
  it('classifies safe files (hash matches)', () => {
    const content = 'original';
    writeFileSync(join(TEST_DIR, 'loom.md'), content);
    const manifest = {
      filesCreated: ['loom.md'],
      filesUpdated: [],
      fileChecksums: { 'loom.md': sha256(content) },
    };
    const result = classifyFiles(TEST_DIR, manifest);
    expect(result.safe).toEqual(['loom.md']);
    expect(result.modified).toEqual([]);
    expect(result.missing).toEqual([]);
  });

  it('classifies modified files (hash differs)', () => {
    writeFileSync(join(TEST_DIR, 'loom.md'), 'changed');
    const manifest = {
      filesCreated: ['loom.md'],
      filesUpdated: [],
      fileChecksums: { 'loom.md': sha256('original') },
    };
    const result = classifyFiles(TEST_DIR, manifest);
    expect(result.safe).toEqual([]);
    expect(result.modified).toEqual(['loom.md']);
  });

  it('classifies missing files', () => {
    const manifest = {
      filesCreated: ['gone.md'],
      filesUpdated: [],
      fileChecksums: { 'gone.md': sha256('was here') },
    };
    const result = classifyFiles(TEST_DIR, manifest);
    expect(result.missing).toEqual(['gone.md']);
  });

  it('treats all as modified when no checksums (old manifest)', () => {
    writeFileSync(join(TEST_DIR, 'a.md'), 'content');
    const manifest = {
      filesCreated: ['a.md'],
      filesUpdated: [],
      // no fileChecksums
    };
    const result = classifyFiles(TEST_DIR, manifest);
    expect(result.modified).toEqual(['a.md']);
    expect(result.safe).toEqual([]);
  });

  it('handles mixed safe, modified, and missing', () => {
    writeFileSync(join(TEST_DIR, 'safe.md'), 'safe');
    writeFileSync(join(TEST_DIR, 'modified.md'), 'changed');
    const manifest = {
      filesCreated: ['safe.md', 'modified.md', 'missing.md'],
      filesUpdated: [],
      fileChecksums: {
        'safe.md': sha256('safe'),
        'modified.md': sha256('original'),
        'missing.md': sha256('gone'),
      },
    };
    const result = classifyFiles(TEST_DIR, manifest);
    expect(result.safe).toEqual(['safe.md']);
    expect(result.modified).toEqual(['modified.md']);
    expect(result.missing).toEqual(['missing.md']);
  });
});
