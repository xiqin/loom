/**
 * fs-interface.js — 文件系统抽象层
 *
 * NodeFileSystem: 委托 node:fs（生产环境）
 * InMemoryFileSystem: 内存模拟（测试环境）
 */

import {
  existsSync as _existsSync,
  readFileSync as _readFileSync,
  writeFileSync as _writeFileSync,
  mkdirSync as _mkdirSync,
  readdirSync as _readdirSync,
  renameSync as _renameSync,
  rmSync as _rmSync,
  openSync as _openSync,
  closeSync as _closeSync,
  statSync as _statSync,
} from 'node:fs';

export class NodeFileSystem {
  existsSync(path) { return _existsSync(path); }
  readFileSync(path, encoding) { return _readFileSync(path, encoding); }
  writeFileSync(path, data, encoding) { return _writeFileSync(path, data, encoding); }
  mkdirSync(path, options) { return _mkdirSync(path, options); }
  readdirSync(path, options) { return _readdirSync(path, options); }
  renameSync(oldPath, newPath) { return _renameSync(oldPath, newPath); }
  rmSync(path, options) { return _rmSync(path, options); }
  openSync(path, flags) { return _openSync(path, flags); }
  closeSync(fd) { return _closeSync(fd); }
  statSync(path) { return _statSync(path); }
}

class FakeDirent {
  constructor(name, isFile) {
    this.name = name;
    this._isFile = isFile;
  }
  isFile() { return this._isFile; }
  isDirectory() { return !this._isFile; }
}

class FakeStats {
  constructor(isFile, mtimeMs = Date.now()) {
    this._isFile = isFile;
    this.mtimeMs = mtimeMs;
  }
  isFile() { return this._isFile; }
  isDirectory() { return !this._isFile; }
}

export class InMemoryFileSystem {
  constructor() {
    this._files = new Map();
    this._dirs = new Set();
    this._fds = new Map();
    this._nextFd = 3;
  }

  // ── 基础操作 ────────────────────────────────────────────────────────────

  existsSync(path) {
    const p = this._normalize(path);
    return this._files.has(p) || this._dirs.has(p);
  }

  readFileSync(path, encoding) {
    const p = this._normalize(path);
    if (!this._files.has(p)) {
      const err = new Error(`ENOENT: no such file or directory, open '${path}'`);
      err.code = 'ENOENT';
      throw err;
    }
    const data = this._files.get(p);
    return encoding ? data.toString() : Buffer.from(data);
  }

  writeFileSync(path, data, encoding) {
    const p = this._normalize(path);
    this._files.set(p, typeof data === 'string' ? data : data.toString());
    // 自动创建父目录
    const parent = p.substring(0, p.lastIndexOf('/'));
    if (parent) this._ensureDir(parent);
  }

  mkdirSync(path, options) {
    const p = this._normalize(path);
    if (this._dirs.has(p)) return;
    if (this._files.has(p)) {
      const err = new Error(`EEXIST: file already exists, mkdir '${path}'`);
      err.code = 'EEXIST';
      throw err;
    }
    if (options?.recursive) {
      this._ensureDir(p);
    } else {
      const parent = p.substring(0, p.lastIndexOf('/'));
      if (parent && !this._dirs.has(parent)) {
        const err = new Error(`ENOENT: no such file or directory, mkdir '${path}'`);
        err.code = 'ENOENT';
        throw err;
      }
      this._dirs.add(p);
    }
  }

  readdirSync(path, options) {
    const p = this._normalize(path);
    if (!this._dirs.has(p)) {
      const err = new Error(`ENOENT: no such file or directory, scandir '${path}'`);
      err.code = 'ENOENT';
      throw err;
    }

    const entries = [];
    const entryMap = new Map(); // name → { name, _isFile }
    const prefix = p === '/' ? '/' : p + '/';

    for (const filePath of this._files.keys()) {
      if (!filePath.startsWith(prefix)) continue;
      const rest = filePath.slice(prefix.length);
      const name = rest.split('/')[0];
      if (name && !entryMap.has(name)) {
        entryMap.set(name, { name, _isFile: true });
      }
    }

    for (const dirPath of this._dirs) {
      if (dirPath === p) continue;
      if (!dirPath.startsWith(prefix)) continue;
      const rest = dirPath.slice(prefix.length);
      const name = rest.split('/')[0];
      if (name) {
        // 目录条目优先于文件条目（同名碰撞时，含子文件的路径一定是目录）
        entryMap.set(name, { name, _isFile: false });
      }
    }

    entries.push(...entryMap.values());

    if (options?.withFileTypes) {
      return entries.map(e => new FakeDirent(e.name, e._isFile));
    }
    return entries.map(e => e.name);
  }

  renameSync(oldPath, newPath) {
    const op = this._normalize(oldPath);
    const np = this._normalize(newPath);
    if (this._files.has(op)) {
      this._files.set(np, this._files.get(op));
      this._files.delete(op);
    } else if (this._dirs.has(op)) {
      // 移动目录及其所有子项
      const prefix = op + '/';
      for (const [k, v] of this._files) {
        if (k.startsWith(prefix)) {
          this._files.set(np + k.slice(op.length), v);
          this._files.delete(k);
        }
      }
      for (const d of [...this._dirs]) {
        if (d === op || d.startsWith(prefix)) {
          this._dirs.add(np + d.slice(op.length));
          this._dirs.delete(d);
        }
      }
      this._dirs.add(np);
      this._dirs.delete(op);
    } else {
      const err = new Error(`ENOENT: no such file or directory, rename '${oldPath}'`);
      err.code = 'ENOENT';
      throw err;
    }
  }

  rmSync(path, options) {
    const p = this._normalize(path);
    if (this._files.has(p)) {
      this._files.delete(p);
      return;
    }
    if (this._dirs.has(p)) {
      if (options?.recursive) {
        const prefix = p + '/';
        for (const k of [...this._files.keys()]) {
          if (k === p || k.startsWith(prefix)) this._files.delete(k);
        }
        for (const d of [...this._dirs]) {
          if (d === p || d.startsWith(prefix)) this._dirs.delete(d);
        }
      } else {
        this._dirs.delete(p);
      }
      return;
    }
    if (!options?.force) {
      const err = new Error(`ENOENT: no such file or directory, rm '${path}'`);
      err.code = 'ENOENT';
      throw err;
    }
  }

  openSync(path, flags) {
    const p = this._normalize(path);
    if (flags === 'wx' || flags === 'ax') {
      if (this._files.has(p)) {
        const err = new Error(`EEXIST: file already exists, open '${path}'`);
        err.code = 'EEXIST';
        throw err;
      }
    }
    const fd = this._nextFd++;
    this._fds.set(fd, { path: p, flags });
    if (!this._files.has(p)) {
      this._files.set(p, '');
    }
    return fd;
  }

  closeSync(fd) {
    this._fds.delete(fd);
  }

  statSync(path) {
    const p = this._normalize(path);
    if (this._files.has(p)) return new FakeStats(true);
    if (this._dirs.has(p)) return new FakeStats(false);
    const err = new Error(`ENOENT: no such file or directory, stat '${path}'`);
    err.code = 'ENOENT';
    throw err;
  }

  // ── 测试辅助 ──────────────────────────────────────────────────────────

  seed(path, content) {
    const p = this._normalize(path);
    this._files.set(p, content);
    const parent = p.substring(0, p.lastIndexOf('/'));
    if (parent) this._ensureDir(parent);
    return this;
  }

  getWrittenFiles() {
    return new Map(this._files);
  }

  // ── 内部 ──────────────────────────────────────────────────────────────

  _normalize(path) {
    // 统一路径分隔符，去除末尾 /
    let p = path.replace(/\\/g, '/');
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
    return p;
  }

  _ensureDir(p) {
    const parts = p.split('/').filter(Boolean);
    let current = '';
    for (let i = 0; i < parts.length; i++) {
      current = current + '/' + parts[i];
      this._dirs.add(current);
    }
  }
}
