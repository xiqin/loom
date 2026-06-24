import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PipelineStateStore } from '../../src/core/state-store.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'loom-handoff-')); }

async function capture(fn) {
  const outputs = [];
  const errors = [];
  const origExit = process.exitCode;
  process.exitCode = undefined;
  const log = vi.spyOn(console, 'log').mockImplementation(msg => outputs.push(String(msg)));
  const err = vi.spyOn(console, 'error').mockImplementation(msg => errors.push(String(msg)));
  try {
    await fn();
  } finally {
    log.mockRestore();
    err.mockRestore();
  }
  const exitCode = process.exitCode;
  process.exitCode = origExit;
  return { exitCode, output: outputs.join('\n'), error: errors.join('\n') };
}

afterEach(() => vi.restoreAllMocks());

describe('loom handoff command', () => {
  it('writes a stage handoff and refreshes progress.md', async () => {
    const root = tmp();
    const specDir = join(root, 'specs', 'feature');
    mkdirSync(specDir, { recursive: true });
    new PipelineStateStore(specDir).init('feature');

    const { default: handoff } = await import('../../src/commands/handoff.js');
    const result = await capture(() => handoff('write', {
      cwd: root,
      specDir: 'specs/feature',
      stage: 'planning',
      status: 'done',
      summary: '计划完成',
      artifacts: 'plan.md,tasks/'
    }));

    expect(result.exitCode).toBeUndefined();
    expect(result.output).toContain('handoffs/planning.json');
    const handoffJson = JSON.parse(readFileSync(join(specDir, 'handoffs', 'planning.json'), 'utf-8'));
    expect(handoffJson).toMatchObject({ stage: 'planning', task_id: 'planning', summary: '计划完成', artifacts: ['plan.md', 'tasks/'] });
    const progress = readFileSync(join(specDir, 'progress.md'), 'utf-8');
    expect(progress).toContain('| `planning` | done | 计划完成 | plan.md, tasks/ |');
  });

  it('shows stage handoff summary in status output', async () => {
    const root = tmp();
    const specDir = join(root, 'specs', 'feature');
    mkdirSync(specDir, { recursive: true });
    const store = new PipelineStateStore(specDir);
    store.init('feature');
    store.writeStageHandoff('brainstorming', {
      status: 'done',
      summary: 'spec 已确认',
      artifacts: ['spec.md']
    });

    const { default: status } = await import('../../src/commands/status.js');
    const result = await capture(() => status({ cwd: root, specDir: 'specs/feature' }));

    expect(result.output).toContain('Handoffs:');
    expect(result.output).toContain('brainstorming: done — spec 已确认 → artifacts: [spec.md]');
  });

  it('rejects invalid handoff status', async () => {
    const root = tmp();
    const specDir = join(root, 'specs', 'feature');
    mkdirSync(specDir, { recursive: true });
    new PipelineStateStore(specDir).init('feature');

    const { default: handoff } = await import('../../src/commands/handoff.js');
    const result = await capture(() => handoff('write', {
      cwd: root,
      specDir: 'specs/feature',
      stage: 'planning',
      status: 'almost-done',
      summary: 'bad'
    }));

    expect(result.exitCode).toBe(1);
    expect(result.error).toContain('Invalid handoff status');
  });

  it('rejects project root as spec_dir before writing handoff', async () => {
    const root = tmp();

    const { default: handoff } = await import('../../src/commands/handoff.js');
    const result = await capture(() => handoff('write', {
      cwd: root,
      specDir: '.',
      stage: 'planning',
      summary: 'bad path'
    }));

    expect(result.exitCode).toBe(1);
    expect(result.error).toContain('points at project root');
  });
});
