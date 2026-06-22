import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, existsSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { TaskLock } from '../../src/core/task-lock.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'loom-tasklock-')); }

describe('TaskLock', () => {
  let dir;
  beforeEach(() => { dir = tmp(); });

  it('acquires a lock for a task', () => {
    const tl = new TaskLock(dir);
    const result = tl.acquire('task-1');
    expect(result.acquired).toBe(true);
    expect(result.taskId).toBe('task-1');
    tl.release('task-1');
  });

  it('prevents concurrent acquisition of the same task', () => {
    const tl = new TaskLock(dir);
    tl.acquire('task-1');
    const result2 = tl.acquire('task-1');
    expect(result2.acquired).toBe(false);
    expect(result2.holder.pid).toBeDefined();
    tl.release('task-1');
  });

  it('allows concurrent acquisition of different tasks', () => {
    const tl = new TaskLock(dir);
    const result1 = tl.acquire('task-1');
    const result2 = tl.acquire('task-2');
    expect(result1.acquired).toBe(true);
    expect(result2.acquired).toBe(true);
    tl.release('task-1');
    tl.release('task-2');
  });

  it('releases a lock and allows re-acquire', () => {
    const tl = new TaskLock(dir);
    tl.acquire('task-1');
    tl.release('task-1');
    const result = tl.acquire('task-1');
    expect(result.acquired).toBe(true);
    tl.release('task-1');
  });

  it('reclaims lock from a dead PID', () => {
    const lockDir = join(dir, '.loom-tasks');
    mkdirSync(lockDir, { recursive: true });
    writeFileSync(join(lockDir, 'task-1.lock'), JSON.stringify({
      pid: 999999,
      token: 'dead',
      startedAt: '2020-01-01T00:00:00Z',
      acquiredAt: Date.now() - 60000
    }), 'utf-8');

    const tl = new TaskLock(dir);
    const result = tl.acquire('task-1');
    expect(result.acquired).toBe(true);
    tl.release('task-1');
  });

  it('releaseAll releases all held locks', () => {
    const tl = new TaskLock(dir);
    tl.acquire('task-1');
    tl.acquire('task-2');
    tl.releaseAll();
    expect(existsSync(join(dir, '.loom-tasks', 'task-1.lock'))).toBe(false);
    expect(existsSync(join(dir, '.loom-tasks', 'task-2.lock'))).toBe(false);
  });

  describe('detectDeadlock', () => {
    it('detects circular dependencies', () => {
      const tl = new TaskLock(dir);
      const graph = {
        'task-1': { depends: ['task-2'] },
        'task-2': { depends: ['task-3'] },
        'task-3': { depends: ['task-1'] }
      };
      const result = tl.detectDeadlock(graph);
      expect(result.hasDeadlock).toBe(true);
      expect(result.cycle.length).toBeGreaterThan(0);
    });

    it('returns false for linear dependencies', () => {
      const tl = new TaskLock(dir);
      const graph = {
        'task-1': { depends: ['task-2'] },
        'task-2': { depends: ['task-3'] },
        'task-3': { depends: [] }
      };
      const result = tl.detectDeadlock(graph);
      expect(result.hasDeadlock).toBe(false);
    });

    it('returns false for empty graph', () => {
      const tl = new TaskLock(dir);
      expect(tl.detectDeadlock({}).hasDeadlock).toBe(false);
    });
  });

  describe('detectLivelock', () => {
    it('detects stale blocked tasks', () => {
      const tl = new TaskLock(dir);
      const states = {
        'task-1': {
          status: 'blocked',
          waitingFor: 'task-2',
          lastUpdate: new Date(Date.now() - 10 * 60 * 1000).toISOString()
        }
      };
      const result = tl.detectLivelock(states);
      expect(result.hasLivelock).toBe(true);
      expect(result.blockingTasks.length).toBe(1);
    });

    it('ignores recently updated tasks', () => {
      const tl = new TaskLock(dir);
      const states = {
        'task-1': {
          status: 'blocked',
          waitingFor: 'task-2',
          lastUpdate: new Date().toISOString()
        }
      };
      const result = tl.detectLivelock(states);
      expect(result.hasLivelock).toBe(false);
    });
  });
});
