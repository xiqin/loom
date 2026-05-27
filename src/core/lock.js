/**
 * lock.js — PID 文件锁
 *
 * 每个 spec 目录下的 .loom-run.lock 防止重复启动同一 spec 的执行引擎。
 * 使用标准 PID 文件机制：写 PID，退出时删除，读取时用 kill -0 验活。
 */

import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

export class SpecLock {
  constructor(specDir) {
    this.lockPath = join(specDir, '.loom-run.lock');
  }

  /** 尝试加锁。返回 { acquired: bool, pid?: number } */
  acquire() {
    if (existsSync(this.lockPath)) {
      const content = readFileSync(this.lockPath, 'utf-8').trim();
      const [pidStr, startedAt] = content.split('\n');
      const pid = parseInt(pidStr);

      if (!isNaN(pid) && pid > 0) {
        try {
          process.kill(pid, 0); // 只检查进程是否存活，不发信号
          return { acquired: false, pid, startedAt: startedAt?.trim() };
        } catch {
          // 进程已死，锁文件是残留，清理后重新获取
          this._removeLock();
        }
      }
    }

    writeFileSync(
      this.lockPath,
      `${process.pid}\n${new Date().toISOString()}`,
      'utf-8'
    );

    // 进程退出时自动释放锁
    const cleanup = () => this._removeLock();
    process.once('exit', cleanup);
    process.once('SIGINT', () => { cleanup(); process.exit(130); });
    process.once('SIGTERM', () => { cleanup(); process.exit(143); });

    return { acquired: true, pid: process.pid };
  }

  /** 强制释放（用于 loom run --force 或测试）*/
  release() { this._removeLock(); }

  isLocked() {
    if (!existsSync(this.lockPath)) return false;
    const content = readFileSync(this.lockPath, 'utf-8').trim();
    const pid = parseInt(content.split('\n')[0]);
    if (isNaN(pid)) return false;
    try { process.kill(pid, 0); return true; }
    catch { this._removeLock(); return false; }
  }

  _removeLock() {
    try { rmSync(this.lockPath, { force: true }); } catch {}
  }
}
