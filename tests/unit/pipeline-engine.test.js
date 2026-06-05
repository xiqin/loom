import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadWorkflow, PipelineEngine } from '../../src/core/pipeline-engine.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'loom-engine-')); }

function setupProject(yaml) {
  const root = tmp();
  mkdirSync(join(root, '.loom'), { recursive: true });
  writeFileSync(join(root, '.loom', 'workflow.yaml'), yaml, 'utf-8');
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '9.9.9' }), 'utf-8');
  return root;
}

const MINIMAL_WF = `
defaults:
  pipeline_type: feature
  max_retries: 3
pipelines:
  feature:
    description: "flow with a #hashtag inside quotes"
    steps:
      - id: brainstorming
        skill: loom-brainstorming
        next: planning
        outputs: [spec.md]
      - id: planning
        skill: loom-writing-plans
        next: approved
        outputs: [plan.md]
      - id: approved
        gate: human-approval
        next: synced
      - id: synced
        skill: loom-index-update
        outputs: []
`;

describe('loadWorkflow / parser', () => {
  it('parses pipelines and preserves # inside quoted description', () => {
    const root = setupProject(MINIMAL_WF);
    const wf = loadWorkflow(root);
    expect(Object.keys(wf.pipelines)).toContain('feature');
    expect(wf.defaults.pipeline_type).toBe('feature');
    expect(wf.defaults.max_retries).toBe(3);
    expect(wf.pipelines.feature).toHaveLength(4);
  });

  it('throws (loud) when no pipelines parse', () => {
    const root = setupProject('garbage: true\nnothing here\n');
    expect(() => loadWorkflow(root)).toThrow(/Failed to parse any pipelines/);
  });
});

describe('PipelineEngine flow', () => {
  let root, specDir, engine;
  beforeEach(() => {
    root = setupProject(MINIMAL_WF);
    specDir = join(root, 'specs', 'x');
    mkdirSync(specDir, { recursive: true });
    engine = new PipelineEngine(root, specDir);
    engine.initialize('feature');
  });

  it('blocks advance when stage output (spec.md) missing', () => {
    const r = engine.advance();
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/outputs incomplete/);
  });

  it('advances once stage output present', () => {
    writeFileSync(join(specDir, 'spec.md'), '# spec content', 'utf-8');
    const r = engine.advance();
    expect(r.ok).toBe(true);
    expect(r.to).toBe('planning');
  });

  it('refuses to auto-advance past a human-approval gate', () => {
    writeFileSync(join(specDir, 'spec.md'), '# spec', 'utf-8');
    writeFileSync(join(specDir, 'plan.md'), '# plan', 'utf-8');
    engine.advance(); // → planning
    engine.advance(); // → approved (gate)
    expect(engine.currentStage()).toBe('approved');
    const r = engine.advance();
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/human-approval gate/);
  });

  it('approve() passes the gate', () => {
    writeFileSync(join(specDir, 'spec.md'), '# spec', 'utf-8');
    writeFileSync(join(specDir, 'plan.md'), '# plan', 'utf-8');
    engine.advance(); engine.advance(); // → approved
    const r = engine.approve();
    expect(r.ok).toBe(true);
    expect(r.to).toBe('synced');
  });

  it('reads version from project package.json', () => {
    const s = engine.snapshot().pipeline;
    expect(s.loom_version).toBe('9.9.9');
  });
});
