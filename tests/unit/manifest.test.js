import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  getManifestPath,
  readManifest,
  writeManifest,
  createManifest,
} from '../../src/core/manifest.js';

const TEST_DIR = join(import.meta.dirname, '__test_manifest__');

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('getManifestPath', () => {
  it('returns .loom/install-manifest.json path', () => {
    const p = getManifestPath(TEST_DIR);
    expect(p).toBe(join(TEST_DIR, '.loom', 'install-manifest.json'));
  });
});

describe('createManifest', () => {
  it('creates manifest with required fields', () => {
    const m = createManifest({
      version: '1.0.0',
      tool: 'claude-code',
      filesCreated: ['CLAUDE.md'],
      filesUpdated: [],
      backups: [],
      hooksInstalled: false,
      fileChecksums: { 'CLAUDE.md': 'abc123' },
    });
    expect(m.version).toBe('1.0.0');
    expect(m.tool).toBe('claude-code');
    expect(m.filesCreated).toEqual(['CLAUDE.md']);
    expect(m.filesUpdated).toEqual([]);
    expect(m.fileChecksums).toEqual({ 'CLAUDE.md': 'abc123' });
    expect(m.installedAt).toBeDefined();
  });

  it('defaults missing arrays to empty', () => {
    const m = createManifest({ version: '1.0.0', tool: 'cursor' });
    expect(m.filesCreated).toEqual([]);
    expect(m.filesUpdated).toEqual([]);
    expect(m.backups).toEqual([]);
    expect(m.hooksInstalled).toBe(false);
    expect(m.fileChecksums).toEqual({});
  });
});

describe('writeManifest + readManifest', () => {
  it('round-trips manifest data', () => {
    const data = createManifest({
      version: '1.0.1',
      tool: 'copilot',
      filesCreated: ['.github/copilot-instructions.md'],
      fileChecksums: { '.github/copilot-instructions.md': 'def456' },
    });
    writeManifest(TEST_DIR, data);
    const loaded = readManifest(TEST_DIR);
    expect(loaded.version).toBe('1.0.1');
    expect(loaded.tool).toBe('copilot');
    expect(loaded.fileChecksums['.github/copilot-instructions.md']).toBe('def456');
  });

  it('creates .loom directory if missing', () => {
    const data = createManifest({ version: '1.0.0', tool: 'cursor' });
    writeManifest(TEST_DIR, data);
    expect(existsSync(join(TEST_DIR, '.loom', 'install-manifest.json'))).toBe(true);
  });
});

describe('readManifest', () => {
  it('returns null if manifest does not exist', () => {
    expect(readManifest(TEST_DIR)).toBeNull();
  });

  it('returns null on invalid JSON', () => {
    mkdirSync(join(TEST_DIR, '.loom'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.loom', 'install-manifest.json'), 'not json');
    expect(readManifest(TEST_DIR)).toBeNull();
  });
});
