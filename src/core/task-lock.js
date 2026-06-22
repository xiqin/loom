/**
 * task-lock.js — 细粒度 task 级锁
 *
 * 每个 task 独立锁定，允许多个 subagent 并行处理不同 task。
 * 复用 SpecLock 的原子获取 + PID 检测 + token 校验模式。
 * 额外提供依赖等待、死锁/活锁检测。
 */

import { NodeFileSystem } from './fs-interface.js';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;

export class TaskLock {
  constructor(specDir, { fs } = {}) {
    this.specDir = specDir;
    this.fs = fs || new NodeFileSystem();
    this.lockDir = join(specDir, '.loom-tasks');
    this.fs.mkdirSync(this.lockDir, { recursive: true });
    this.activeLocks = new Map(); // taskId -> { token, lockFile }
  }

  /**
   * 获取单个 task 的锁
   * @param {string} taskId
   * @param {number} [timeoutMs=30min] 锁超时（超时自动视为可回收）
   * @returns {{ acquired: boolean, taskId: string, holder?: { pid, startedAt } }}
   */
  acquire(taskId, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const lockFile = join(this.lockDir, `${taskId}.lock`);
    const token = randomBytes(8).toString('hex');
    const now = Date.now();
    const payload = JSON.stringify({
      pid: process.pid,
      token,
      startedAt: new Date().toISOString(),
      acquiredAt: now
    });

    let fd;
    try {
      fd = this.fs.openSync(lockFile, 'wx');
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;

      const holder = this._readLock(lockFile);
      if (!holder) {
        // 损坏的锁文件，清理后重试一次
        this._removeLockFile(lockFile);
        return this._retryAcquire(taskId, lockFile, token, now, payload);
      }

      // 检查超时
      if (holder.acquiredAt && (now - holder.acquiredAt > timeoutMs)) {
        this._removeLockFile(lockFile);
        return this._retryAcquire(taskId, lockFile, token, now, payload);
      }

      // 检查 PID 是否存活
      if (holder.pid && this._isAlive(holder.pid)) {
        return { acquired: false, taskId, holder: { pid: holder.pid, startedAt: holder.startedAt } };
      }

      // PID 已死，清理残留锁
      this._removeLockFile(lockFile);
      return this._retryAcquire(taskId, lockFile, token, now, payload);
    }

    this.fs.writeFileSync(fd, payload, 'utf-8');
    this.fs.closeSync(fd);
    this.activeLocks.set(taskId, { token, lockFile });
    return { acquired: true, taskId };
  }

  /**
   * 带重试的加锁
   * @param {string} taskId
   * @param {number} [maxWaitMs=60000] 最大等待时间
   */
  async acquireWithWait(taskId, maxWaitMs = 60000) {
    const startTime = Date.now();
    const retryInterval = 500;

    while (Date.now() - startTime < maxWaitMs) {
      const result = this.acquire(taskId);
      if (result.acquired) return result;
      await new Promise(r => setTimeout(r, retryInterval));
    }

    throw new Error(`Failed to acquire lock for task "${taskId}" within ${maxWaitMs}ms`);
  }

  /**
   * 等待多个 task 完成（锁释放 = 任务完成）
   * @param {string[]} taskIds
   * @param {number} [timeoutMs=10min]
   */
  async waitFor(taskIds, timeoutMs = 10 * 60 * 1000) {
    const startTime = Date.now();
    const pollInterval = 1000;

    while (Date.now() - startTime < timeoutMs) {
      const allDone = taskIds.every(id => {
        const lockFile = join(this.lockDir, `${id}.lock`);
        return !this.fs.existsSync(lockFile);
      });
      if (allDone) return { success: true };
      await new Promise(r => setTimeout(r, pollInterval));
    }

    throw new Error(`Timeout waiting for tasks: ${taskIds.join(', ')} (${timeoutMs}ms)`);
  }

  /** 释放 task 锁 */
  release(taskId) {
    const lock = this.activeLocks.get(taskId);
    if (!lock) return;
    // token 校验：只删自己持有的锁
    const holder = this._readLock(lock.lockFile);
    if (holder && holder.token && holder.token !== lock.token) return;
    this._removeLockFile(lock.lockFile);
    this.activeLocks.delete(taskId);
  }

  /** 释放本进程持有的所有锁 */
  releaseAll() {
    for (const taskId of this.activeLocks.keys()) {
      this.release(taskId);
    }
  }

  // ── 死锁/活锁检测 ────────────────────────────────────────────────────

  /**
   * 检测任务图中的环形依赖（死锁）
   * @param {object} taskGraph - { taskId: { depends: [taskId, ...] } }
   * @returns {{ hasDeadlock: boolean, cycle?: string[] }}
   */
  detectDeadlock(taskGraph) {
    const visited = new Set();
    const recStack = new Set();
    let cycle = null;

    const dfs = (node, path) => {
      visited.add(node);
      recStack.add(node);

      const deps = taskGraph[node]?.depends || [];
      for (const dep of deps) {
        if (cycle) return;
        if (!visited.has(dep)) {
          dfs(dep, [...path, dep]);
        } else if (recStack.has(dep)) {
          const cycleStart = path.indexOf(dep);
          cycle = cycleStart >= 0 ? path.slice(cycleStart) : [dep];
          cycle.push(dep);
        }
      }

      recStack.delete(node);
    };

    for (const taskId of Object.keys(taskGraph)) {
      if (!visited.has(taskId)) {
        dfs(taskId, [taskId]);
        if (cycle) return { hasDeadlock: true, cycle };
      }
    }

    return { hasDeadlock: false };
  }

  /**
   * 检查活锁（任务长时间无更新）
   * @param {object} taskStates - { taskId: { status, waitingFor, lastUpdate } }
   * @returns {{ hasLivelock: boolean, blockingTasks: object[] }}
   */
  detectLivelock(taskStates, staleThresholdMs = 5 * 60 * 1000) {
    const now = Date.now();
    const blockingTasks = [];

    for (const [taskId, state] of Object.entries(taskStates)) {
      if (state.status === 'blocked' || state.status === 'waiting') {
        const waitDuration = now - new Date(state.lastUpdate).getTime();
        if (waitDuration > staleThresholdMs) {
          blockingTasks.push({
            taskId,
            waitingFor: state.waitingFor,
            durationSec: Math.round(waitDuration / 1000)
          });
        }
      }
    }

    return { hasLivelock: blockingTasks.length > 0, blockingTasks };
  }

  // ── 内部工具 ────────────────────────────────────────────────────────

  _retryAcquire(taskId, lockFile, token, now, payload) {
    let fd;
    try {
      fd = this.fs.openSync(lockFile, 'wx');
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      const holder = this._readLock(lockFile);
      return { acquired: false, taskId, holder: { pid: holder?.pid, startedAt: holder?.startedAt } };
    }
    this.fs.writeFileSync(fd, payload, 'utf-8');
    this.fs.closeSync(fd);
    this.activeLocks.set(taskId, { token, lockFile });
    return { acquired: true, taskId };
  }

  _readLock(lockFile) {
    try {
      return JSON.parse(this.fs.readFileSync(lockFile, 'utf-8'));
    } catch {
      return null;
    }
  }

  _removeLockFile(lockFile) {
    try { this.fs.rmSync(lockFile, { force: true }); } catch {}
  }

  _isAlive(pid) {
    try {
      process.kill(pid, 0);
      return true;
    } catch (err) {
      return err.code === 'EPERM';
    }
  }
}
