import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

const _require = createRequire(import.meta.url);

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), 'rss-handler-test-'));
}

describe('session-start handler', () => {
  let origCwd;
  let handler;

  beforeEach(() => {
    origCwd = process.cwd();
    const mod = _require('../../hooks/handlers/session-start.cjs');
    handler = mod.run;
  });

  afterEach(() => {
    process.chdir(origCwd);
    vi.restoreAllMocks();
  });

  it('skips when not in project root', () => {
    const dir = makeTempDir();
    process.chdir(dir);
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    handler();
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('No project root detected'),
    );
  });

  it('prints warning when constitution.md missing', () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'package.json'), '{}');
    process.chdir(dir);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    handler();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('项目未初始化'));
  });

  it('does nothing when constitution.md exists', () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'package.json'), '{}');
    mkdirSync(join(dir, '.rss', 'memory'), { recursive: true });
    writeFileSync(join(dir, '.rss', 'memory', 'constitution.md'), '# Constitution');
    process.chdir(dir);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    handler();
    expect(spy).not.toHaveBeenCalled();
  });
});
