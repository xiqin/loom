import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createBackup, cleanupBackups, BACKUP_DIR } from '../../src/utils/backup.js';

const TEST_DIR = join(import.meta.dirname, '__test_backup__');

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  writeFileSync(join(TEST_DIR, 'test.md'), 'original content');
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('createBackup', () => {
  it('creates backup of specified files', () => {
    const files = [join(TEST_DIR, 'test.md')];
    const backupPath = createBackup(TEST_DIR, files);
    expect(existsSync(backupPath)).toBe(true);
    const backed = readFileSync(join(backupPath, 'test.md'), 'utf-8');
    expect(backed).toBe('original content');
  });

  it('creates timestamped backup directory', () => {
    const files = [join(TEST_DIR, 'test.md')];
    const backupPath = createBackup(TEST_DIR, files);
    expect(backupPath).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
  });

  it('creates backup directory if not exists', () => {
    const files = [join(TEST_DIR, 'test.md')];
    createBackup(TEST_DIR, files);
    const backupRoot = join(TEST_DIR, BACKUP_DIR);
    expect(existsSync(backupRoot)).toBe(true);
  });
});

describe('cleanupBackups', () => {
  it('keeps only the most recent N backups', () => {
    const backupRoot = join(TEST_DIR, BACKUP_DIR);
    mkdirSync(backupRoot, { recursive: true });
    // create 7 backup dirs
    for (let i = 0; i < 7; i++) {
      mkdirSync(join(backupRoot, `2026-01-0${i}T00-00-00`));
    }
    cleanupBackups(TEST_DIR, 5);
    const remaining = readdirSync(backupRoot);
    expect(remaining.length).toBe(5);
  });
});
