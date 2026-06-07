import { describe, it, expect } from 'vitest';
import { InMemoryFileSystem } from '../../src/core/fs-interface.js';

describe('InMemoryFileSystem', () => {
  it('writeFileSync + readFileSync', () => {
    const fs = new InMemoryFileSystem();
    fs.writeFileSync('/tmp/test.txt', 'hello', 'utf-8');
    expect(fs.readFileSync('/tmp/test.txt', 'utf-8')).toBe('hello');
  });

  it('existsSync returns true for written files', () => {
    const fs = new InMemoryFileSystem();
    expect(fs.existsSync('/tmp/test.txt')).toBe(false);
    fs.writeFileSync('/tmp/test.txt', 'content', 'utf-8');
    expect(fs.existsSync('/tmp/test.txt')).toBe(true);
  });

  it('existsSync returns true for created directories', () => {
    const fs = new InMemoryFileSystem();
    fs.mkdirSync('/tmp/a/b', { recursive: true });
    expect(fs.existsSync('/tmp/a')).toBe(true);
    expect(fs.existsSync('/tmp/a/b')).toBe(true);
  });

  it('readFileSync throws ENOENT for missing files', () => {
    const fs = new InMemoryFileSystem();
    expect(() => fs.readFileSync('/no/such/file', 'utf-8')).toThrow(/ENOENT/);
  });

  it('mkdirSync recursive creates parent dirs', () => {
    const fs = new InMemoryFileSystem();
    fs.mkdirSync('/deep/nested/dir', { recursive: true });
    expect(fs.existsSync('/deep/nested/dir')).toBe(true);
  });

  it('readdirSync lists entries', () => {
    const fs = new InMemoryFileSystem();
    fs.writeFileSync('/tmp/a.txt', 'a', 'utf-8');
    fs.writeFileSync('/tmp/b.txt', 'b', 'utf-8');
    fs.mkdirSync('/tmp/sub', { recursive: true });
    const entries = fs.readdirSync('/tmp');
    expect(entries).toContain('a.txt');
    expect(entries).toContain('b.txt');
    expect(entries).toContain('sub');
  });

  it('readdirSync with withFileTypes returns Dirent-like objects', () => {
    const fs = new InMemoryFileSystem();
    fs.writeFileSync('/tmp/file.txt', 'f', 'utf-8');
    fs.mkdirSync('/tmp/dir', { recursive: true });
    const entries = fs.readdirSync('/tmp', { withFileTypes: true });
    const file = entries.find(e => e.name === 'file.txt');
    const dir = entries.find(e => e.name === 'dir');
    expect(file.isFile()).toBe(true);
    expect(dir.isDirectory()).toBe(true);
  });

  it('renameSync moves files', () => {
    const fs = new InMemoryFileSystem();
    fs.writeFileSync('/tmp/old.txt', 'data', 'utf-8');
    fs.renameSync('/tmp/old.txt', '/tmp/new.txt');
    expect(fs.existsSync('/tmp/old.txt')).toBe(false);
    expect(fs.readFileSync('/tmp/new.txt', 'utf-8')).toBe('data');
  });

  it('rmSync removes files', () => {
    const fs = new InMemoryFileSystem();
    fs.writeFileSync('/tmp/del.txt', 'x', 'utf-8');
    fs.rmSync('/tmp/del.txt');
    expect(fs.existsSync('/tmp/del.txt')).toBe(false);
  });

  it('rmSync recursive removes directories', () => {
    const fs = new InMemoryFileSystem();
    fs.writeFileSync('/tmp/dir/file.txt', 'x', 'utf-8');
    fs.rmSync('/tmp/dir', { recursive: true, force: true });
    expect(fs.existsSync('/tmp/dir/file.txt')).toBe(false);
  });

  it('openSync wx throws EEXIST when file exists', () => {
    const fs = new InMemoryFileSystem();
    fs.writeFileSync('/tmp/lock', '1', 'utf-8');
    expect(() => fs.openSync('/tmp/lock', 'wx')).toThrow(/EEXIST/);
  });

  it('openSync wx succeeds when file does not exist', () => {
    const fs = new InMemoryFileSystem();
    const fd = fs.openSync('/tmp/newlock', 'wx');
    expect(typeof fd).toBe('number');
    expect(fs.existsSync('/tmp/newlock')).toBe(true);
    fs.closeSync(fd);
  });

  it('statSync returns isFile/isDirectory', () => {
    const fs = new InMemoryFileSystem();
    fs.writeFileSync('/tmp/f.txt', 'x', 'utf-8');
    fs.mkdirSync('/tmp/d', { recursive: true });
    expect(fs.statSync('/tmp/f.txt').isFile()).toBe(true);
    expect(fs.statSync('/tmp/d').isDirectory()).toBe(true);
  });

  it('seed helper writes file and creates parent dirs', () => {
    const fs = new InMemoryFileSystem();
    fs.seed('/tmp/deep/file.txt', 'content');
    expect(fs.readFileSync('/tmp/deep/file.txt', 'utf-8')).toBe('content');
    expect(fs.existsSync('/tmp/deep')).toBe(true);
  });

  it('getWrittenFiles returns all files', () => {
    const fs = new InMemoryFileSystem();
    fs.seed('/a.txt', 'a');
    fs.seed('/b.txt', 'b');
    const files = fs.getWrittenFiles();
    expect(files.size).toBe(2);
    expect(files.get('/a.txt')).toBe('a');
  });

  it('handles Windows-style paths', () => {
    const fs = new InMemoryFileSystem();
    fs.writeFileSync('C:\\tmp\\test.txt', 'hello', 'utf-8');
    expect(fs.existsSync('C:/tmp/test.txt')).toBe(true);
    expect(fs.readFileSync('C:\\tmp\\test.txt', 'utf-8')).toBe('hello');
  });
});
