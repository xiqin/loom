import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

const _require = createRequire(import.meta.url);
const { checkProject, formatReport, isProjectRoot } =
  _require('../../hooks/handlers/health-check.cjs');

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), 'loom-health-test-'));
}

function initLoom(dir, { workflow = true } = {}) {
  mkdirSync(join(dir, '.loom', 'memory'), { recursive: true });
  writeFileSync(join(dir, '.loom', 'memory', 'constitution.md'), '# Constitution');
  if (workflow) writeFileSync(join(dir, '.loom', 'workflow.yaml'), 'version: 1');
}

describe('health-check.checkProject', () => {
  it('returns no-project outside a project root', () => {
    const dir = makeTempDir();
    expect(checkProject(dir).state).toBe('no-project');
  });

  it('returns uninitialized when constitution.md missing', () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'package.json'), '{}');
    expect(checkProject(dir).state).toBe('uninitialized');
  });

  it('returns healthy when fully initialized', () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'package.json'), '{}');
    initLoom(dir);
    const result = checkProject(dir);
    expect(result.state).toBe('healthy');
    expect(result.issues).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('flags missing workflow.yaml as an issue', () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'package.json'), '{}');
    initLoom(dir, { workflow: false });
    const result = checkProject(dir);
    expect(result.state).toBe('issues');
    expect(result.issues.some(i => i.includes('workflow.yaml'))).toBe(true);
  });

  it('flags unrendered constitution placeholders', () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'package.json'), '{}');
    initLoom(dir);
    mkdirSync(join(dir, '.loom', 'rules'), { recursive: true });
    writeFileSync(join(dir, '.loom', 'rules', 'constitution.md'), 'name: {{PROJECT_NAME}}');
    const result = checkProject(dir);
    expect(result.state).toBe('issues');
    expect(result.issues.some(i => i.includes('{{PROJECT_NAME}}'))).toBe(true);
  });

  it('warns when spec.md exists without plan.md', () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'package.json'), '{}');
    initLoom(dir);
    mkdirSync(join(dir, 'specs', '20260601-feature'), { recursive: true });
    writeFileSync(join(dir, 'specs', '20260601-feature', 'spec.md'), '# spec');
    const result = checkProject(dir);
    expect(result.state).toBe('issues');
    expect(result.warnings.some(w => w.includes('缺少 plan.md'))).toBe(true);
  });
});

describe('health-check.formatReport', () => {
  it('returns empty for healthy/no-project', () => {
    expect(formatReport({ state: 'healthy', issues: [], warnings: [] })).toEqual([]);
    expect(formatReport({ state: 'no-project', issues: [], warnings: [] })).toEqual([]);
  });

  it('reports init hint when uninitialized', () => {
    const lines = formatReport({ state: 'uninitialized', issues: [], warnings: [] });
    expect(lines.join('\n')).toContain('项目未初始化');
    expect(lines.join('\n')).toContain('/loom-init-project');
  });

  it('lists issues and warnings', () => {
    const lines = formatReport({
      state: 'issues',
      issues: ['缺少 .loom/workflow.yaml'],
      warnings: ['specs/x: 缺少 plan.md'],
    });
    const text = lines.join('\n');
    expect(text).toContain('workflow.yaml');
    expect(text).toContain('plan.md');
  });
});

describe('health-check.isProjectRoot', () => {
  it('detects common project markers', () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'go.mod'), 'module x');
    expect(isProjectRoot(dir)).toBe(true);
  });
});
