/**
 * lock.js — PID 文件锁
 *
 * 每个 spec 目录下的 .loom-run.lock 防止重复启动同一 spec 的执行引擎。
 * 原子获取：openSync(path, 'wx') 利用 O_EXCL，create-if-not-exists 是单系统调用，
 * 消除 check-then-write 竞态。锁内含 PID + 随机 token，释放时校验 token，
 * 避免 PID 被系统复用后误删他人锁文件。
 */

import { NodeFileSystem } from './fs-interface.js';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';

// 同一进程内的退出 handler 只注册一次，避免长生命周期进程（MCP server）累积监听器
let exitHandlersInstalled = false;
const activeLocks = new Set(); // 本进程持有的锁实例，退出时统一释放

function installExitHandlers() {
  if (exitHandlersInstalled) return;
  exitHandlersInstalled = true;
  const releaseAll = () => {
    for (const lock of activeLocks) lock._removeLock();
  };
  process.once('exit', releaseAll);
  process.once('SIGINT', () => { releaseAll(); process.exit(130); });
  process.once('SIGTERM', () => { releaseAll(); process.exit(143); });
}

export class SpecLock {
  constructor(specDir, { fs } = {}) {
    this.lockPath = join(specDir, '.loom-run.lock');
    this.token = null; // 持锁时的本进程 token
    this.fs = fs || new NodeFileSystem();
  }

  /** 尝试加锁。返回 { acquired: bool, pid?: number, startedAt?: string } */
  acquire() {
    this.fs.mkdirSync(dirname(this.lockPath), { recursive: true });
    const token = randomBytes(8).toString('hex');
    const startedAt = new Date().toISOString();
    const payload = `${process.pid}\n${startedAt}\n${token}`;

    let fd;
    try {
      // O_EXCL：文件已存在则抛 EEXIST，原子建锁
      fd = this.fs.openSync(this.lockPath, 'wx');
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      // 锁文件已存在 → 检查持有者是否存活
      const holder = this._readLock();
      if (holder.pid && this._isAlive(holder.pid)) {
        return { acquired: false, pid: holder.pid, startedAt: holder.startedAt };
      }
      // 持有者已死 → 残留锁，清理后重试一次
      this._removeLock();
      try {
        fd = this.fs.openSync(this.lockPath, 'wx');
      } catch (err2) {
        if (err2.code !== 'EEXIST') throw err2;
        // 竞争中被别的进程抢先
        const h2 = this._readLock();
        return { acquired: false, pid: h2.pid, startedAt: h2.startedAt };
      }
    }

    this.fs.writeFileSync(fd, payload, 'utf-8');
    this.fs.closeSync(fd);
    this.token = token;
    activeLocks.add(this);
    installExitHandlers();
    return { acquired: true, pid: process.pid, startedAt };
  }

  /** 强制释放（用于 loom run --force 或测试）*/
  release() {
    this._removeLock();
  }

  /**
   * 带重试的加锁（异步，指数退避）。
   * 适用于 MCP server 多 session 并发场景。
   * @param {number} maxRetries  最大重试次数（默认 5）
   * @param {number} retryDelayMs  首次重试延迟毫秒（默认 200，后续指数退避）
   */
  async acquireWithRetry(maxRetries = 5, retryDelayMs = 200) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const result = this.acquire();
      if (result.acquired) return result;
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, retryDelayMs * (2 ** attempt)));
      }
    }
    const holder = this._readLock();
    return { acquired: false, pid: holder.pid, startedAt: holder.startedAt };
  }

  /** 是否被某个存活进程持有 */
  isLocked() {
    if (!this.fs.existsSync(this.lockPath)) return false;
    const holder = this._readLock();
    if (!holder.pid) return false;
    if (this._isAlive(holder.pid)) return true;
    // 持有者已死 → 残留锁，清理
    this._removeLock();
    return false;
  }

  // ── 内部 ──────────────────────────────────────────────────────────────────

  _readLock() {
    try {
      const content = this.fs.readFileSync(this.lockPath, 'utf-8').trim();
      const [pidStr, startedAt, token] = content.split('\n');
      const pid = parseInt(pidStr);
      return {
        pid: !isNaN(pid) && pid > 0 ? pid : null,
        startedAt: startedAt?.trim() || null,
        token: token?.trim() || null
      };
    } catch {
      return { pid: null, startedAt: null, token: null };
    }
  }

  _isAlive(pid) {
    try {
      process.kill(pid, 0); // 只探测存活，不发信号
      return true;
    } catch (err) {
      // EPERM：进程存在但无权限 → 视为存活；ESRCH：不存在
      return err.code === 'EPERM';
    }
  }

  _removeLock() {
    // 只删本进程持有的锁（token 匹配）或无主残留锁，避免 PID 复用后误删他人锁
    if (this.token) {
      const holder = this._readLock();
      if (holder.token && holder.token !== this.token) return; // 不是我的锁
    }
    try { this.fs.rmSync(this.lockPath, { force: true }); } catch {}
    this.token = null;
    activeLocks.delete(this);
  }
}
