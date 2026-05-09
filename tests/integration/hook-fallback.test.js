import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runHook } from '../../hooks/run-hook.js';

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), 'rss-hook-fallback-'));
}

describe('hook fallback handling (integration)', () => {
  let dir;

  beforeEach(() => {
    dir = makeTempDir();
    mkdirSync(join(dir, 'handlers'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('skip fallback: silent on handler failure', async () => {
    writeFileSync(join(dir, 'hooks.json'), JSON.stringify([
      { id: 'test', entry: 'handlers/test.cjs', timeoutMs: 5000, fallback: 'skip' },
    ]));
    writeFileSync(join(dir, 'handlers', 'test.cjs'),
      `module.exports = function() { throw new Error('boom'); };`);
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const result = await runHook('test', { hooksDir: dir, platform: 'linux' });
    expect(result.status).toBe('skipped');
    expect(debugSpy).toHaveBeenCalled();
  });

  it('warn fallback: warns on handler failure', async () => {
    writeFileSync(join(dir, 'hooks.json'), JSON.stringify([
      { id: 'test', entry: 'handlers/test.cjs', timeoutMs: 5000, fallback: 'warn' },
    ]));
    writeFileSync(join(dir, 'handlers', 'test.cjs'),
      `module.exports = function() { throw new Error('boom'); };`);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await runHook('test', { hooksDir: dir, platform: 'linux' });
    expect(result.status).toBe('warned');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('error fallback: returns failed status', async () => {
    writeFileSync(join(dir, 'hooks.json'), JSON.stringify([
      { id: 'test', entry: 'handlers/test.cjs', timeoutMs: 5000, fallback: 'error' },
    ]));
    writeFileSync(join(dir, 'handlers', 'test.cjs'),
      `module.exports = function() { throw new Error('boom'); };`);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await runHook('test', { hooksDir: dir, platform: 'linux' });
    expect(result.status).toBe('failed');
    expect(result.message).toContain('1 attempt(s)');
  });

  it('retry fallback: retries then fails', async () => {
    writeFileSync(join(dir, 'hooks.json'), JSON.stringify([
      { id: 'test', entry: 'handlers/test.cjs', timeoutMs: 1000, fallback: 'retry', retryCount: 2 },
    ]));
    let calls = 0;
    writeFileSync(join(dir, 'handlers', 'test.cjs'), `
      module.exports = function() {
        calls++;
        throw new Error('attempt ' + calls);
      };
      var calls = 0;
    `);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await runHook('test', { hooksDir: dir, platform: 'linux' });
    expect(result.status).toBe('failed');
    expect(result.message).toContain('3 attempt(s)');
  });

  it('retry fallback: succeeds on retry', async () => {
    writeFileSync(join(dir, 'hooks.json'), JSON.stringify([
      { id: 'test', entry: 'handlers/test.cjs', timeoutMs: 1000, fallback: 'retry', retryCount: 2 },
    ]));
    writeFileSync(join(dir, 'handlers', 'test.cjs'), `
      var attempt = 0;
      module.exports = function() {
        attempt++;
        if (attempt < 2) throw new Error('not yet');
        return 'ok';
      };
    `);
    const result = await runHook('test', { hooksDir: dir, platform: 'linux' });
    expect(result.status).toBe('ok');
  });

  it('timeout triggers fallback strategy', async () => {
    writeFileSync(join(dir, 'hooks.json'), JSON.stringify([
      { id: 'test', entry: 'handlers/test.cjs', timeoutMs: 50, fallback: 'warn' },
    ]));
    writeFileSync(join(dir, 'handlers', 'test.cjs'),
      `module.exports = async function() { await new Promise(r => setTimeout(r, 500)); };`);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await runHook('test', { hooksDir: dir, platform: 'linux' });
    expect(result.status).toBe('warned');
  });

  it('missing handler file triggers fallback', async () => {
    writeFileSync(join(dir, 'hooks.json'), JSON.stringify([
      { id: 'test', entry: 'handlers/missing.cjs', timeoutMs: 5000, fallback: 'skip' },
    ]));
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    const result = await runHook('test', { hooksDir: dir, platform: 'linux' });
    expect(result.status).toBe('failed');
    expect(result.message).toContain('Handler load error');
  });

  it('non-function handler triggers failure', async () => {
    writeFileSync(join(dir, 'hooks.json'), JSON.stringify([
      { id: 'test', entry: 'handlers/test.cjs', timeoutMs: 5000, fallback: 'warn' },
    ]));
    writeFileSync(join(dir, 'handlers', 'test.cjs'),
      `module.exports = { notAFunction: true };`);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await runHook('test', { hooksDir: dir, platform: 'linux' });
    expect(result.status).toBe('failed');
    expect(result.message).toContain('not a function');
  });
});
