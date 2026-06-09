import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

const _require = createRequire(import.meta.url);

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), 'loom-handler-test-'));
}

describe('session-start handler', () => {
  let handler;
  let cwdSpy;

  beforeEach(() => {
    const mod = _require('../../hooks/handlers/session-start.cjs');
    handler = mod.run;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (cwdSpy) cwdSpy.mockRestore();
  });

  it('skips when not in project root', () => {
    const dir = makeTempDir();
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir);
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    handler();
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('No project root detected'),
    );
  });

  it('prints warning when constitution.md missing', () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'package.json'), '{}');
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    handler();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('项目未初始化'));
  });

  it('does nothing when constitution.md exists', () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'package.json'), '{}');
    mkdirSync(join(dir, '.loom', 'memory'), { recursive: true });
    writeFileSync(join(dir, '.loom', 'memory', 'constitution.md'), '# Constitution');
    writeFileSync(join(dir, '.loom', 'workflow.yaml'), 'version: 1');
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    handler();
    expect(spy).not.toHaveBeenCalled();
  });
});
