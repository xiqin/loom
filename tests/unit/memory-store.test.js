import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MemoryStore } from '../../src/core/memory-store.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'loom-mem-')); }

describe('MemoryStore', () => {
  let store;
  beforeEach(() => { store = new MemoryStore(tmp()); });

  it('add + list', () => {
    store.add('决策', '用 JSON 文件存状态', { author: 'tester' });
    const list = store.list({ type: '决策' });
    expect(list).toHaveLength(1);
    expect(list[0].content).toBe('用 JSON 文件存状态');
    expect(list[0].id).toHaveLength(8);
  });

  it('save is atomic — store.json stays valid JSON', () => {
    store.add('踩坑', 'a'); store.add('偏好', 'b');
    expect(() => JSON.parse(readFileSync(store.storePath, 'utf-8'))).not.toThrow();
  });

  it('remove by id', () => {
    const e = store.add('状态', 'tmp');
    expect(store.remove(e.id)).toBe(true);
    expect(store.list()).toHaveLength(0);
  });

  it('exportMarkdown writes MEMORY.md', () => {
    store.add('决策', 'x');
    store.exportMarkdown();
    expect(existsSync(store.mdPath)).toBe(true);
    expect(readFileSync(store.mdPath, 'utf-8')).toMatch(/Project Memory/);
  });
});
