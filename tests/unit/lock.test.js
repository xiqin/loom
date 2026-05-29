import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SpecLock } from '../../src/core/lock.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'loom-lock-')); }

describe('SpecLock', () => {
  let dir;
  beforeEach(() => { dir = tmp(); });

  it('acquires and writes lock file', () => {
    const lock = new SpecLock(dir);
    const res = lock.acquire();
    expect(res.acquired).toBe(true);
    expect(res.pid).toBe(process.pid);
    expect(existsSync(join(dir, '.loom-run.lock'))).toBe(true);
    lock.release();
  });

  it('second acquire on live holder fails', () => {
    const a = new SpecLock(dir);
    a.acquire();
    const b = new SpecLock(dir);
    const res = b.acquire();
    expect(res.acquired).toBe(false);
    expect(res.pid).toBe(process.pid);
    a.release();
  });

  it('reclaims lock from a dead PID', () => {
    // 写一个不存在进程的残留锁
    writeFileSync(join(dir, '.loom-run.lock'), `999999\n2020-01-01T00:00:00Z\ndeadtoken`, 'utf-8');
    const lock = new SpecLock(dir);
    expect(lock.isLocked()).toBe(false); // 死进程 → 视为未锁
    const res = lock.acquire();
    expect(res.acquired).toBe(true);
    lock.release();
  });

  it('release removes the lock file', () => {
    const lock = new SpecLock(dir);
    lock.acquire();
    lock.release();
    expect(existsSync(join(dir, '.loom-run.lock'))).toBe(false);
  });

  it('token holder does NOT delete a lock rewritten by another (PID-reuse guard)', () => {
    const lock = new SpecLock(dir);
    lock.acquire(); // 写入 token_A
    // 模拟：锁被另一进程重写为 token_B
    writeFileSync(join(dir, '.loom-run.lock'), `${process.pid}\n2099-01-01T00:00:00Z\nother_token_B`, 'utf-8');
    lock._removeLock(); // 持 token_A 的实例尝试清理
    expect(existsSync(join(dir, '.loom-run.lock'))).toBe(true); // token 不匹配 → 不删
  });
});
