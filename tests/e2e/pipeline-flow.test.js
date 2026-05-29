import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { PipelineEngine } from '../../src/core/pipeline-engine.js';
import { PipelineStateStore } from '../../src/core/state-store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');

function tmp() { return mkdtempSync(join(tmpdir(), 'loom-e2e-')); }

/** 用仓库自带的真实 templates/workflow.yaml 搭一个项目 */
function setupRealProject() {
  const root = tmp();
  mkdirSync(join(root, '.loom'), { recursive: true });
  copyFileSync(join(REPO_ROOT, 'templates', 'workflow.yaml'), join(root, '.loom', 'workflow.yaml'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '2.0.1' }), 'utf-8');
  const specDir = join(root, 'specs', '2026-05-30+demo');
  mkdirSync(specDir, { recursive: true });
  return { root, specDir };
}

const write = (dir, file, body) => writeFileSync(join(dir, file), body, 'utf-8');

describe('feature pipeline end-to-end (real workflow.yaml)', () => {
  it('walks brainstorming → planning → approved → git-worktree → executing → verification → synced', () => {
    const { root, specDir } = setupRealProject();
    const engine = new PipelineEngine(root, specDir);
    engine.initialize('feature');
    expect(engine.currentStage()).toBe('brainstorming');

    // brainstorming → planning
    write(specDir, 'spec.md', '# Spec\nComplete requirement.');
    expect(engine.advance()).toMatchObject({ ok: true, to: 'planning' });

    // planning → approved (gate)
    write(specDir, 'plan.md', '# Plan\nTasks laid out.');
    expect(engine.advance()).toMatchObject({ ok: true, to: 'approved' });

    // gate: must approve, cannot auto-advance
    expect(engine.advance().ok).toBe(false);
    expect(engine.approve()).toMatchObject({ ok: true, to: 'git-worktree' });

    // git-worktree → executing (executing precondition needs tasks/ dir)
    mkdirSync(join(specDir, 'tasks'), { recursive: true });
    write(specDir, 'tasks/T1.md', 'task one');
    expect(engine.advance()).toMatchObject({ ok: true, to: 'executing' });

    // executing → verification requires test-report PASS
    write(specDir, 'test-report.md', 'ran suite\nverdict: PASS');
    expect(engine.advance()).toMatchObject({ ok: true, to: 'verification' });

    // verification → synced requires verify-report PASS
    write(specDir, 'verify-report.md', 'all checks passed\nverdict: PASS');
    expect(engine.advance()).toMatchObject({ ok: true, to: 'synced' });

    expect(engine.currentStage()).toBe('synced');

    // 状态文件完整、历史齐全
    const snap = new PipelineStateStore(specDir).snapshot();
    expect(snap.pipeline.stage_history.length).toBeGreaterThanOrEqual(5);
  });

  it('blocks synced when verify-report says FAIL', () => {
    const { root, specDir } = setupRealProject();
    const engine = new PipelineEngine(root, specDir);
    engine.initialize('feature');
    write(specDir, 'spec.md', '# Spec');
    engine.advance();
    write(specDir, 'plan.md', '# Plan');
    engine.advance();
    engine.approve();
    mkdirSync(join(specDir, 'tasks'), { recursive: true });
    write(specDir, 'tasks/T1.md', 't');
    engine.advance(); // executing
    write(specDir, 'test-report.md', 'verdict: PASS');
    engine.advance(); // verification
    write(specDir, 'verify-report.md', 'verdict: FAIL');
    const r = engine.advance();
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/verify-report/);
  });
});
