import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PipelineSelector } from '../../src/core/pipeline-selector.js';

function setupProject() {
  const root = mkdtempSync(join(tmpdir(), 'loom-sel-'));
  mkdirSync(join(root, '.loom'), { recursive: true });
  copyFileSync(
    join(process.cwd(), 'templates', 'workflow.yaml'),
    join(root, '.loom', 'workflow.yaml')
  );
  return root;
}

function setupSpecDir() {
  return mkdtempSync(join(tmpdir(), 'loom-sel-spec-'));
}

function assessment(overrides = {}) {
  return {
    runtimeBehavior: 'none',
    dataImpact: 'none',
    securityImpact: 'none',
    deploymentImpact: 'none',
    publicApiImpact: 'none',
    dependencyImpact: 'none',
    scope: { fileCount: 1, moduleCount: 1, crossModule: 'no' },
    changeKind: 'chore',
    confidence: 'high',
    evidence: ['已确认影响范围'],
    ...overrides
  };
}

describe('PipelineSelector', () => {
  let projectRoot;

  beforeEach(() => {
    projectRoot = setupProject();
  });

  describe('assessment normalization', () => {
    it('normalizes missing and invalid values without treating them as none', () => {
      const sel = new PipelineSelector(projectRoot);
      expect(sel._normalizeAssessment({
        runtimeBehavior: 'invalid',
        scope: { fileCount: -1, moduleCount: 1.5, crossModule: 'maybe' },
        evidence: 'not-an-array'
      })).toEqual({
        runtimeBehavior: 'unknown',
        dataImpact: 'unknown',
        securityImpact: 'unknown',
        deploymentImpact: 'unknown',
        publicApiImpact: 'unknown',
        dependencyImpact: 'unknown',
        scope: { fileCount: null, moduleCount: null, crossModule: 'unknown' },
        changeKind: 'unknown',
        confidence: 'low',
        evidence: []
      });
    });

    it('keeps non-negative integer scope and trims evidence', () => {
      const sel = new PipelineSelector(projectRoot);
      const normalized = sel._normalizeAssessment(assessment({
        scope: { fileCount: 0, moduleCount: 2, crossModule: 'yes' },
        evidence: ['  fact  ', '', 3]
      }));
      expect(normalized.scope).toEqual({ fileCount: 0, moduleCount: 2, crossModule: 'yes' });
      expect(normalized.evidence).toEqual(['fact']);
    });
  });

  describe('risk policy', () => {
    const cases = [
      ['all none', assessment(), 'low'],
      ['runtime changed', assessment({ runtimeBehavior: 'changed' }), 'medium'],
      ['deployment changed', assessment({ deploymentImpact: 'changed' }), 'medium'],
      ['public API changed', assessment({ publicApiImpact: 'changed' }), 'medium'],
      ['data migration', assessment({ dataImpact: 'migration' }), 'high'],
      ['destructive data', assessment({ dataImpact: 'destructive' }), 'high'],
      ['security changed', assessment({ securityImpact: 'changed' }), 'high'],
      ['unknown impact', assessment({ dependencyImpact: 'unknown' }), 'medium']
    ];

    it.each(cases)('%s -> %s risk', (_name, input, expected) => {
      const sel = new PipelineSelector(projectRoot);
      expect(sel._assessRiskFromAssessment(sel._normalizeAssessment(input))).toBe(expected);
    });
  });

  describe('governance policy', () => {
    const cases = [
      ['low chore', assessment(), 'lightweight'],
      ['medium bugfix', assessment({ runtimeBehavior: 'changed', changeKind: 'bugfix' }), 'standard'],
      ['hotfix governance floor', assessment({ changeKind: 'hotfix' }), 'standard'],
      ['public API change', assessment({ publicApiImpact: 'changed', changeKind: 'bugfix' }), 'structured'],
      ['feature', assessment({ changeKind: 'feature' }), 'structured'],
      ['refactor', assessment({ changeKind: 'refactor' }), 'structured'],
      ['cross module', assessment({ scope: { fileCount: 2, moduleCount: 2, crossModule: 'yes' } }), 'structured'],
      ['high risk', assessment({ securityImpact: 'changed' }), 'structured']
    ];

    it.each(cases)('%s -> %s governance', (_name, input, expected) => {
      const sel = new PipelineSelector(projectRoot);
      const normalized = sel._normalizeAssessment(input);
      expect(sel._assessGovernance(normalized)).toBe(expected);
    });
  });

  describe('assessment-based selection', () => {
    it('selects lightweight for confirmed no-impact config samples without filename rules', async () => {
      const sel = new PipelineSelector(projectRoot);
      const result = await sel.select(
        '生成脱敏配置样例并更新 .gitignore',
        assessment({ scope: { fileCount: 5, moduleCount: 1, crossModule: 'no' } })
      );
      expect(result).toMatchObject({
        source: 'supplied-assessment',
        risk: 'low',
        governance: 'lightweight'
      });
      expect(result.steps.map(step => step.id)).toEqual(['executing', 'verification']);
    });

    it('selects the standard planning and review chain for a normal behavior-changing bugfix', async () => {
      const sel = new PipelineSelector(projectRoot);
      const result = await sel.select('修复普通 bug', assessment({
        runtimeBehavior: 'changed',
        changeKind: 'bugfix'
      }));
      expect(result.risk).toBe('medium');
      expect(result.governance).toBe('standard');
      expect(result.steps.map(step => step.id)).toEqual([
        'planning', 'approved', 'executing', 'verification',
        'code-review-request', 'review-gate', 'code-review-response', 'synced'
      ]);
      expect(result.steps.find(step => step.id === 'executing').requires).toEqual(['plan.md', 'tasks/']);
      expect(result.steps.find(step => step.id === 'verification').requires).toEqual(['test-report.md']);
    });

    it('selects all structured quality stages before any artifacts exist', async () => {
      const sel = new PipelineSelector(projectRoot);
      const result = await sel.select('新增用户功能', assessment({
        runtimeBehavior: 'changed',
        changeKind: 'feature',
        scope: { fileCount: null, moduleCount: null, crossModule: 'unknown' }
      }));
      const ids = result.steps.map(step => step.id);
      expect(result.governance).toBe('structured');
      expect(ids).toEqual([
        'brainstorming', 'detail-expansion', 'planning', 'analyze-artifacts',
        'approved', 'git-worktree', 'executing', 'converge', 'verification',
        'code-review-request', 'review-gate', 'code-review-response', 'synced'
      ]);
    });

    it('reuses an existing structured spec but retains all future quality stages', async () => {
      const specDir = setupSpecDir();
      writeFileSync(join(specDir, 'spec.md'), '# Spec');
      writeFileSync(join(specDir, 'requirements.json'), '{"requirements":[]}');
      const sel = new PipelineSelector(projectRoot, specDir);
      const result = await sel.select('重构模块', assessment({ changeKind: 'refactor' }));
      const ids = result.steps.map(step => step.id);
      expect(ids).not.toContain('brainstorming');
      expect(ids).toContain('detail-expansion');
      expect(ids).toContain('analyze-artifacts');
      expect(ids).toContain('converge');
    });

    it('does not allow unknown impact to become lightweight', async () => {
      const sel = new PipelineSelector(projectRoot);
      const result = await sel.select('范围不明确', { changeKind: 'chore' });
      expect(result.risk).toBe('medium');
      expect(result.governance).toBe('standard');
    });

    it('uses the complete structured chain for a high-risk hotfix assessment', async () => {
      const sel = new PipelineSelector(projectRoot);
      const result = await sel.select('生产紧急安全修复', assessment({
        securityImpact: 'changed',
        changeKind: 'hotfix'
      }));

      expect(result.governance).toBe('structured');
      expect(result.signals.profile).toBe('structured');
      expect(result.steps.map(step => step.id)).toEqual([
        'brainstorming', 'detail-expansion', 'planning', 'analyze-artifacts',
        'approved', 'git-worktree', 'executing', 'converge', 'verification',
        'code-review-request', 'review-gate', 'code-review-response', 'synced'
      ]);
    });
  });

  describe('compatibility paths', () => {
    it('keeps quickfix and chore keyword short-circuits lightweight', async () => {
      const sel = new PipelineSelector(projectRoot);
      const quickfix = await sel.select('修复 README 里的 typo');
      const chore = await sel.select('依赖升级 npm update');
      expect(quickfix.source).toBe('short-circuit:quickfix');
      expect(chore.source).toBe('short-circuit:chore');
      expect(quickfix.steps.map(step => step.id)).toEqual(['executing', 'verification']);
      expect(chore.steps.map(step => step.id)).toEqual(['executing', 'verification']);
    });

    it('uses conservative medium/standard fallback when no assessment is available', async () => {
      const sel = new PipelineSelector(projectRoot);
      const result = await sel.select('处理一个没有明确影响说明的任务');
      expect(result).toMatchObject({
        source: 'fallback:medium-risk',
        risk: 'medium',
        governance: 'standard'
      });
    });

    it('does not infer lightweight governance from low-risk words without assessment facts', async () => {
      const sel = new PipelineSelector(projectRoot);
      const result = await sel.select('更新文档说明');
      expect(result).toMatchObject({
        source: 'fallback:medium-risk',
        risk: 'medium',
        governance: 'standard'
      });
    });

    it('does not match a file-limited quickfix when file scope is unknown', async () => {
      const sel = new PipelineSelector(projectRoot);
      const result = await sel.select('修改登录文案并调整鉴权逻辑');
      expect(result.source).not.toBe('short-circuit:quickfix');
      expect(result.governance).not.toBe('lightweight');
    });

    it('uses standard step contracts for a root-cause-known bugfix short circuit', async () => {
      const sel = new PipelineSelector(projectRoot);
      const result = await sel.select('已定位根因，修复单文件 bug');
      expect(result.source).toBe('short-circuit:bugfix-no-brainstorm');
      expect(result.governance).toBe('standard');
      expect(result.steps.map(step => step.id)).not.toContain('brainstorming');
      expect(result.steps.find(step => step.id === 'executing')).toMatchObject({
        requires: ['plan.md', 'tasks/'],
        gate_verdict: 'test-report.md',
        evidence_required: true
      });
    });

    it('keeps an approval gate for hotfix assessments', async () => {
      const sel = new PipelineSelector(projectRoot);
      const result = await sel.select('生产紧急 P0 故障', assessment({ changeKind: 'hotfix' }));
      expect(result.governance).toBe('standard');
      expect(result.steps.map(step => step.id)).toEqual(['approved', 'executing', 'verification']);
      expect(result.steps.find(step => step.id === 'executing').requires).toEqual([]);
    });

    it('gives hotfix precedence over overlapping quickfix and chore signals', async () => {
      const sel = new PipelineSelector(projectRoot);
      const quickfixOverlap = await sel.select('生产紧急 P0，修复单文件 typo');
      const choreOverlap = await sel.select('生产紧急线上故障，需要依赖升级');

      for (const result of [quickfixOverlap, choreOverlap]) {
        expect(result.source).toBe('short-circuit:hotfix');
        expect(result.risk).toBe('high');
        expect(result.steps.map(step => step.id)).toEqual(['approved', 'executing', 'verification']);
      }
    });

    it('ignores a partial supplied assessment and preserves request short circuits', async () => {
      const sel = new PipelineSelector(projectRoot);
      const partial = {
        runtimeBehavior: 'none',
        dataImpact: 'none',
        securityImpact: 'none',
        deploymentImpact: 'none',
        publicApiImpact: 'none',
        dependencyImpact: 'none'
      };
      const result = await sel.select('生产紧急 P0 故障', partial);

      expect(result.source).toBe('short-circuit:hotfix');
      expect(result.steps.map(step => step.id)).toEqual(['approved', 'executing', 'verification']);
    });

    it('uses structured fallback for explicit refactor signals', async () => {
      const sel = new PipelineSelector(projectRoot);
      const result = await sel.select('重构状态管理，跨模块改动');
      expect(result.risk).toBe('high');
      expect(result.governance).toBe('structured');
      expect(result.steps.map(step => step.id)).toContain('converge');
    });
  });

  describe('AI assessment', () => {
    it('derives policy steps from AI facts and ignores AI risk and steps', async () => {
      const fakeClient = {
        complete: async () => JSON.stringify({
          ...assessment({ runtimeBehavior: 'changed', changeKind: 'bugfix' }),
          risk: 'low',
          steps: ['executing']
        })
      };
      const sel = new PipelineSelector(projectRoot, null, { aiClient: fakeClient });
      const result = await sel.select('复杂需求需要 AI 提取事实');
      expect(result.source).toBe('ai-assessment');
      expect(result.risk).toBe('medium');
      expect(result.governance).toBe('standard');
      expect(result.steps.map(step => step.id)).toContain('planning');
      expect(result.steps.map(step => step.id)).toContain('verification');
    });

    it('prompts AI to return facts rather than final decisions', async () => {
      let prompt = '';
      const fakeClient = {
        complete: async value => {
          prompt = value;
          return JSON.stringify(assessment());
        }
      };
      const sel = new PipelineSelector(projectRoot, null, { aiClient: fakeClient });
      await sel.select('判断需求');
      expect(prompt).toContain('Do not choose risk, governance, or steps');
      expect(prompt).toContain('runtimeBehavior');
    });

    it('falls back when AI JSON is invalid or lacks required impact facts', async () => {
      const invalid = new PipelineSelector(projectRoot, null, {
        aiClient: { complete: async () => 'not json' }
      });
      const incomplete = new PipelineSelector(projectRoot, null, {
        aiClient: { complete: async () => JSON.stringify({ changeKind: 'chore' }) }
      });
      expect((await invalid.select('模糊任务')).source).toMatch(/^fallback:/);
      expect((await incomplete.select('模糊任务')).source).toMatch(/^fallback:/);
    });

    it('does not allow incomplete or low-confidence AI facts to select lightweight governance', async () => {
      const incompleteScope = new PipelineSelector(projectRoot, null, {
        aiClient: { complete: async () => JSON.stringify({
          runtimeBehavior: 'none',
          dataImpact: 'none',
          securityImpact: 'none',
          deploymentImpact: 'none',
          publicApiImpact: 'none',
          dependencyImpact: 'none',
          changeKind: 'chore',
          confidence: 'high',
          evidence: ['影响范围未提供']
        }) }
      });
      const lowConfidence = new PipelineSelector(projectRoot, null, {
        aiClient: { complete: async () => JSON.stringify(assessment({ confidence: 'low' })) }
      });

      expect((await incompleteScope.select('维护配置')).source).toMatch(/^fallback:/);
      expect((await lowConfidence.select('维护配置')).governance).not.toBe('lightweight');
    });
  });

  describe('catalog guards and plan rendering', () => {
    it('adds structured mandatory stages by governance, not existing files', () => {
      const sel = new PipelineSelector(projectRoot);
      const steps = sel._validateAndFix(['planning', 'approved', 'executing', 'verification'], {
        governance: 'structured',
        inWorktree: true
      });
      const ids = steps.map(step => step.id);
      expect(ids).toContain('detail-expansion');
      expect(ids).toContain('analyze-artifacts');
      expect(ids).toContain('converge');
    });

    it('does not add structured quality stages to standard governance', () => {
      const sel = new PipelineSelector(projectRoot);
      const steps = sel._validateAndFix(
        ['planning', 'approved', 'executing', 'verification'],
        { governance: 'standard' }
      );
      const ids = steps.map(step => step.id);
      expect(ids).not.toContain('detail-expansion');
      expect(ids).not.toContain('analyze-artifacts');
      expect(ids).not.toContain('converge');
    });

    it('uses the no-spec bugfix contract for standard planning and execution', async () => {
      const sel = new PipelineSelector(projectRoot);
      const result = await sel.select('修复普通 bug', assessment({
        runtimeBehavior: 'changed',
        changeKind: 'bugfix'
      }));
      const planning = result.steps.find(step => step.id === 'planning');
      const executing = result.steps.find(step => step.id === 'executing');

      expect(planning).toMatchObject({
        requires: [],
        outputs: ['plan.md', 'tasks/', 'handoffs/planning.json'],
        validators: []
      });
      expect(executing).toMatchObject({
        requires: ['plan.md', 'tasks/'],
        outputs: ['test-report.md', 'handoffs/executing.json']
      });
    });

    it('preserves validators and human gates in structured dynamic steps', async () => {
      const sel = new PipelineSelector(projectRoot);
      const result = await sel.select('新增功能', assessment({ changeKind: 'feature' }));
      expect(result.steps.find(step => step.id === 'detail-expansion').validators).toContain('detail-expansion-pass');
      expect(result.steps.find(step => step.id === 'analyze-artifacts').validators).toContain('artifact-analysis-pass');
      expect(result.steps.find(step => step.id === 'converge').validators).toContain('convergence-pass');
      expect(result.steps.find(step => step.id === 'review-gate').approval_requires).toEqual(['review-feedback.md']);
    });

    it('renders governance, assessment source and evidence in pipeline-plan.md', async () => {
      const specDir = setupSpecDir();
      const sel = new PipelineSelector(projectRoot, specDir);
      const result = await sel.select('维护样例', assessment({ evidence: ['不修改运行逻辑'] }));
      const { content } = sel.writePipelinePlan(result);
      expect(content).toContain('治理级别: lightweight');
      expect(content).toContain('Assessment 来源: supplied-assessment');
      expect(content).toContain('不修改运行逻辑');
    });

    it('round-trips lightweight governance without changing approved steps or contracts', async () => {
      const specDir = setupSpecDir();
      const sel = new PipelineSelector(projectRoot, specDir);
      const selected = await sel.select('维护样例', assessment());
      sel.writePipelinePlan(selected);

      const restored = sel.readPipelinePlan();
      expect(restored).toEqual(selected.steps);
    });

    it('round-trips the exact hotfix profile without adding planning dependencies', async () => {
      const specDir = setupSpecDir();
      const sel = new PipelineSelector(projectRoot, specDir);
      const selected = await sel.select('生产紧急 P0 故障', assessment({ changeKind: 'hotfix' }));
      sel.writePipelinePlan(selected);

      const restored = sel.readPipelinePlan();
      expect(restored.map(step => step.id)).toEqual(['approved', 'executing', 'verification']);
      expect(restored.find(step => step.id === 'executing').requires).toEqual([]);
    });

    it('revalidates an edited plan using its declared governance', () => {
      const specDir = setupSpecDir();
      const sel = new PipelineSelector(projectRoot, specDir);
      writeFileSync(join(specDir, 'pipeline-plan.md'), [
        '# Pipeline Plan', '', '## 选择分析', '',
        '- 治理级别: standard', '', '## 选择步骤', '',
        '1. **planning** — edited',
        '2. **executing** — edited',
        '3. **verification** — edited', ''
      ].join('\n'));
      const ids = sel.readPipelinePlan().map(step => step.id);
      expect(ids).toContain('approved');
      expect(ids).toContain('executing');
      expect(ids).toContain('verification');
    });

    it('preserves steps when reading a legacy plan without governance metadata', () => {
      const specDir = setupSpecDir();
      const sel = new PipelineSelector(projectRoot, specDir);
      writeFileSync(join(specDir, 'pipeline-plan.md'), [
        '# Pipeline Plan', '', '## 选择步骤', '',
        '1. **executing** — legacy',
        '2. **verification** — legacy', ''
      ].join('\n'));

      expect(sel.readPipelinePlan().map(step => step.id)).toEqual(['executing', 'verification']);
    });
  });
});
