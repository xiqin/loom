import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PipelineStateStore, scanAllSpecs } from '../../src/core/state-store.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'loom-state-')); }

describe('PipelineStateStore', () => {
  let dir, store;
  beforeEach(() => { dir = tmp(); store = new PipelineStateStore(dir); });

  it('init creates valid pipeline state', () => {
    const s = store.init('feature', '2.0.1');
    expect(s.current_stage).toBe('brainstorming');
    expect(s.pipeline_type).toBe('feature');
    const onDisk = JSON.parse(readFileSync(join(dir, 'pipeline.state.json'), 'utf-8'));
    expect(onDisk.loom_version).toBe('2.0.1');
  });

  it('init is idempotent', () => {
    store.init('feature');
    const again = store.init('bugfix'); // 已存在不应覆盖类型
    expect(again.pipeline_type).toBe('feature');
  });

  it('transition records history and advances stage', () => {
    store.init('feature');
    const s = store.transition('planning');
    expect(s.current_stage).toBe('planning');
    expect(s.stage_history).toHaveLength(1);
    expect(s.stage_history[0].stage).toBe('brainstorming');
    expect(s.stage_history[0].status).toBe('passed');
  });

  it('write leaves valid JSON (atomic, no half-write)', () => {
    store.init('feature');
    store.transition('planning');
    expect(() => JSON.parse(readFileSync(join(dir, 'pipeline.state.json'), 'utf-8'))).not.toThrow();
  });

  it('read throws on corrupt (existing but unparseable) state', () => {
    writeFileSync(join(dir, 'pipeline.state.json'), '{ not json', 'utf-8');
    expect(() => store.read()).toThrow(/Corrupt state file/);
  });

  it('read returns null when state absent', () => {
    expect(store.read()).toBe(null);
  });

  it('updateTask creates task state and readAllTasks sorts numerically', () => {
    store.updateTask('T2', { status: 'done' });
    store.updateTask('T10', { status: 'pending' });
    store.updateTask('T1', { status: 'executing' });
    const tasks = store.readAllTasks();
    expect(tasks.map(t => t.task_id)).toEqual(['T1', 'T2', 'T10']);
  });

  it('readAllTasks skips a corrupt task file without throwing', () => {
    store.updateTask('T1', { status: 'done' });
    mkdirSync(join(dir, 'task-states'), { recursive: true });
    writeFileSync(join(dir, 'task-states', 'T2.state.json'), 'garbage', 'utf-8');
    const tasks = store.readAllTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].task_id).toBe('T1');
  });
});

describe('scanAllSpecs', () => {
  it('returns specs with pipeline state and tolerates a corrupt one', () => {
    const root = tmp();
    const specsDir = join(root, 'specs');
    const good = join(specsDir, '2026-01-01+good');
    const bad = join(specsDir, '2026-01-02+bad');
    mkdirSync(good, { recursive: true });
    mkdirSync(bad, { recursive: true });
    new PipelineStateStore(good).init('feature');
    writeFileSync(join(bad, 'pipeline.state.json'), 'not json', 'utf-8');
    const all = scanAllSpecs(root);
    expect(all).toHaveLength(1); // 坏的被跳过
    expect(all[0].pipeline.pipeline_type).toBe('feature');
  });
});
