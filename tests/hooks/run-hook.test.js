import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  detectPlatform,
  loadHooks,
  findHook,
  supportsPlatform,
  withTimeout,
  runHook,
} from '../../hooks/run-hook.js';

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), 'rss-hook-test-'));
}

function writeHandler(dir, code) {
  writeFileSync(join(dir, 'handlers', 'test.cjs'), code);
}

describe('detectPlatform', () => {
  it('returns a known platform string', () => {
    const p = detectPlatform();
    expect(['linux', 'macos', 'windows']).toContain(p);
  });
});

describe('loadHooks', () => {
  it('loads hooks.json from directory', () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'hooks.json'), JSON.stringify([
      { id: 'test', entry: 'handlers/test.cjs' },
    ]));
    const hooks = loadHooks(dir);
    expect(hooks).toHaveLength(1);
    expect(hooks[0].id).toBe('test');
  });

  it('throws on missing hooks.json', () => {
    expect(() => loadHooks('/nonexistent')).toThrow();
  });
});

describe('findHook', () => {
  const hooks = [
    { id: 'session-start', entry: 'handlers/session-start.cjs' },
    { id: 'pre-commit', entry: 'handlers/pre-commit.cjs' },
  ];

  it('finds hook by id', () => {
    expect(findHook(hooks, 'session-start')).toEqual(hooks[0]);
  });

  it('returns null for missing id', () => {
    expect(findHook(hooks, 'nonexistent')).toBeNull();
  });
});

describe('supportsPlatform', () => {
  it('returns true when platforms is empty', () => {
    expect(supportsPlatform({ platforms: [] }, 'linux')).toBe(true);
  });

  it('returns true when platforms is missing', () => {
    expect(supportsPlatform({}, 'linux')).toBe(true);
  });

  it('returns true for supported platform', () => {
    expect(supportsPlatform({ platforms: ['linux', 'macos'] }, 'linux')).toBe(true);
  });

  it('returns false for unsupported platform', () => {
    expect(supportsPlatform({ platforms: ['linux'] }, 'windows')).toBe(false);
  });
});

describe('withTimeout', () => {
  it('returns ok for fast function', async () => {
    const result = await withTimeout(async () => {}, 1000);
    expect(result.ok).toBe(true);
    expect(result.timedOut).toBe(false);
  });

  it('returns error for throwing function', async () => {
    const result = await withTimeout(async () => {
      throw new Error('boom');
    }, 1000);
    expect(result.ok).toBe(false);
    expect(result.timedOut).toBe(false);
    expect(result.error.message).toBe('boom');
  });

  it('returns timedOut for slow function', async () => {
    const result = await withTimeout(async () => {
      await new Promise(r => setTimeout(r, 500));
    }, 50);
    expect(result.ok).toBe(false);
    expect(result.timedOut).toBe(true);
  });

  it('no timeout when timeoutMs is 0', async () => {
    const result = await withTimeout(async () => {}, 0);
    expect(result.ok).toBe(true);
  });
});

describe('runHook', () => {
  let dir;

  beforeEach(() => {
    dir = makeTempDir();
    mkdirSync(join(dir, 'handlers'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('skips unknown hook', async () => {
    writeFileSync(join(dir, 'hooks.json'), JSON.stringify([]));
    const result = await runHook('nonexistent', { hooksDir: dir });
    expect(result.status).toBe('skipped');
    expect(result.message).toContain('not found');
  });

  it('skips hook on unsupported platform', async () => {
    writeFileSync(join(dir, 'hooks.json'), JSON.stringify([
      { id: 'test', entry: 'handlers/test.cjs', platforms: ['linux'], fallback: 'warn' },
    ]));
    writeHandler(dir, 'module.exports = function() {};');
    const result = await runHook('test', { hooksDir: dir, platform: 'windows' });
    expect(result.status).toBe('skipped');
    expect(result.message).toContain('not supported');
  });

  it('runs handler successfully', async () => {
    writeFileSync(join(dir, 'hooks.json'), JSON.stringify([
      { id: 'test', entry: 'handlers/test.cjs', timeoutMs: 5000, fallback: 'warn' },
    ]));
    writeHandler(dir, `
      function handler() { console.log('handler ran'); }
      module.exports = handler;
      module.exports.run = handler;
    `);
    const result = await runHook('test', { hooksDir: dir, platform: 'linux' });
    expect(result.status).toBe('ok');
  });

  it('handles handler failure with warn fallback', async () => {
    writeFileSync(join(dir, 'hooks.json'), JSON.stringify([
      { id: 'test', entry: 'handlers/test.cjs', timeoutMs: 5000, fallback: 'warn' },
    ]));
    writeHandler(dir, `module.exports = function() { throw new Error('handler failed'); };`);
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await runHook('test', { hooksDir: dir, platform: 'linux' });
    expect(result.status).toBe('warned');
    expect(spy).toHaveBeenCalled();
  });

  it('handles handler failure with skip fallback', async () => {
    writeFileSync(join(dir, 'hooks.json'), JSON.stringify([
      { id: 'test', entry: 'handlers/test.cjs', timeoutMs: 5000, fallback: 'skip' },
    ]));
    writeHandler(dir, `module.exports = function() { throw new Error('handler failed'); };`);
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    const result = await runHook('test', { hooksDir: dir, platform: 'linux' });
    expect(result.status).toBe('skipped');
  });

  it('handles handler failure with error fallback', async () => {
    writeFileSync(join(dir, 'hooks.json'), JSON.stringify([
      { id: 'test', entry: 'handlers/test.cjs', timeoutMs: 5000, fallback: 'error' },
    ]));
    writeHandler(dir, `module.exports = function() { throw new Error('handler failed'); };`);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await runHook('test', { hooksDir: dir, platform: 'linux' });
    expect(result.status).toBe('failed');
  });

  it('retries on retry fallback', async () => {
    writeFileSync(join(dir, 'hooks.json'), JSON.stringify([
      { id: 'test', entry: 'handlers/test.cjs', timeoutMs: 5000, fallback: 'retry', retryCount: 2 },
    ]));
    writeHandler(dir, `module.exports = function() { throw new Error('always fails'); };`);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await runHook('test', { hooksDir: dir, platform: 'linux' });
    expect(result.status).toBe('failed');
    expect(result.message).toContain('3 attempt(s)');
  });

  it('handles timeout', async () => {
    writeFileSync(join(dir, 'hooks.json'), JSON.stringify([
      { id: 'test', entry: 'handlers/test.cjs', timeoutMs: 50, fallback: 'warn' },
    ]));
    writeHandler(dir, `module.exports = async function() { await new Promise(r => setTimeout(r, 500)); };`);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await runHook('test', { hooksDir: dir, platform: 'linux' });
    expect(result.status).toBe('warned');
  });

  it('handles missing handler file', async () => {
    writeFileSync(join(dir, 'hooks.json'), JSON.stringify([
      { id: 'test', entry: 'handlers/missing.cjs', timeoutMs: 5000, fallback: 'warn' },
    ]));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await runHook('test', { hooksDir: dir, platform: 'linux' });
    expect(result.status).toBe('failed');
    expect(result.message).toContain('Handler load error');
  });

  it('handles handler that exports named run function', async () => {
    writeFileSync(join(dir, 'hooks.json'), JSON.stringify([
      { id: 'test', entry: 'handlers/test.cjs', timeoutMs: 5000, fallback: 'warn' },
    ]));
    writeHandler(dir, `
      function run() { console.log('named export ran'); }
      module.exports = { run };
    `);
    const result = await runHook('test', { hooksDir: dir, platform: 'linux' });
    expect(result.status).toBe('ok');
  });
});
