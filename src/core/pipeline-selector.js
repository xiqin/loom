/**
 * pipeline-selector.js — 结构化事实驱动的流程选择
 *
 * AI 或调用方只提供工程事实；风险、治理级别和步骤由代码策略决定。
 *
 * 输出经 _validateAndFix 校验：依赖闭包、护栏、gate。
 * 返回步骤对象数组，与 pipeline-engine.getSteps() 返回结构兼容。
 */

import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import yaml from 'js-yaml';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const RISK_KEYWORDS = {
  high: ['重构', '架构', '跨模块', '跨服务', 'refactor', 'architecture', 'cross-module'],
  medium: ['多文件', '新功能', 'feature', '依赖', 'integration', '集成'],
  low: ['typo', '错别字', '单文件', '配置', '文档', '小修复']
};

const IMPACT_VALUES = {
  runtimeBehavior: ['none', 'changed', 'unknown'],
  dataImpact: ['none', 'changed', 'migration', 'destructive', 'unknown'],
  securityImpact: ['none', 'changed', 'unknown'],
  deploymentImpact: ['none', 'changed', 'unknown'],
  publicApiImpact: ['none', 'changed', 'unknown'],
  dependencyImpact: ['none', 'changed', 'unknown']
};

const CHANGE_KINDS = ['feature', 'bugfix', 'refactor', 'chore', 'hotfix', 'unknown'];
const CONFIDENCE_VALUES = ['high', 'medium', 'low'];
const CROSS_MODULE_VALUES = ['yes', 'no', 'unknown'];
const IMPACT_FIELDS = Object.keys(IMPACT_VALUES);

const ROOT_CAUSE_RE = /根因|root\s*cause|已定位|定位到|根因明确/i;

const STEP_ORDER = [
  'brainstorming', 'detail-expansion',
  'planning', 'analyze-artifacts', 'approved', 'git-worktree',
  'executing', 'converge', 'verification',
  'code-review-request', 'review-gate', 'code-review-response',
  'synced'
];

// 增强模块的触发关键词信号（来自 AGENTS.md + step_catalog.skip_when 的反向）
// 注：omission-hunter 由 converge 内部触发，不作为独立 step 出现在主线，此处不列。
const OPTIONAL_SIGNALS = {
  'detail-expansion': [
    '输入', '权限', '鉴权', '授权', '写操作', '状态', '并发', '原子',
    '外部依赖', '安全', '性能', '可观测', '恢复', '兼容', '幂等',
    'input', 'permission', 'auth', 'concurrency', 'security', 'performance',
    'observability', 'idempotent'
  ],
  'analyze-artifacts': [
    '跨模块', '多模块', '跨服务', '架构', '重构',
    'cross-module', 'architecture', 'refactor'
  ],
  'converge': [
    '多任务', '多 task', '并行', '跨模块', '多模块',
    'multi-task', 'parallel', 'cross-module'
  ]
};

export class PipelineSelector {
  constructor(projectRoot, specDir = null, { aiClient } = {}) {
    this.projectRoot = resolve(projectRoot);
    this.specDir = specDir ? resolve(specDir) : null;
    this.aiClient = aiClient || null;
    this.workflow = this._loadWorkflow();
  }

  _loadWorkflow() {
    const wfPath = join(this.projectRoot, '.loom', 'workflow.yaml');
    if (!existsSync(wfPath)) return null;
    try {
      return yaml.load(
        readFileSync(wfPath, 'utf-8'),
        { schema: yaml.DEFAULT_SAFE_SCHEMA }
      );
    } catch {
      return null;
    }
  }

  /**
   * 主入口：选择 steps
   * @param {string} userRequest
   * @returns {Promise<{ steps: object[], source: string, reasoning: string, risk: string, signals: object }>}
   */
  async select(userRequest, suppliedAssessment = null) {
    const signals = this._collectSignals(userRequest);

    if (this._isCompleteAssessment(suppliedAssessment)) {
      return this._selectionFromAssessment(suppliedAssessment, signals, 'supplied-assessment');
    }

    if (this.aiClient) {
      try {
        const aiAssessment = await this._aiAssess(userRequest, signals);
        if (this._isCompleteAssessment(aiAssessment)) {
          return this._selectionFromAssessment(aiAssessment, signals, 'ai-assessment');
        }
      } catch {
        // AI 失败后继续走兼容短路和保守兜底。
      }
    }

    const sc = this._matchShortCircuit(signals);
    if (sc) {
      const risk = sc.name === 'hotfix' ? 'high' : this._assessLegacyRisk(signals);
      const governance = sc.governance || (sc.name === 'hotfix' ? 'standard' : 'lightweight');
      const policySignals = { ...signals, risk, governance, profile: sc.name };
      const steps = this._validateAndFix(sc.steps, policySignals, {
        skipClosure: sc.skip_closure === true,
        skipGate: sc.skip_gate === true,
        skipMandatory: sc.skip_mandatory === true
      });
      return {
        steps,
        source: `short-circuit:${sc.name}`,
        reasoning: `命中关键词规则: ${sc.name}`,
        risk,
        governance,
        assessment: null,
        signals: policySignals
      };
    }

    const fb = this._ruleBasedFallback(signals);
    const policySignals = { ...signals, risk: fb.risk, governance: fb.governance };
    const steps = this._validateAndFix(fb.steps, policySignals);
    return {
      steps,
      source: `fallback:${fb.name}`,
      reasoning: fb.reasoning,
      risk: fb.risk,
      governance: fb.governance,
      assessment: this._normalizeAssessment(null),
      signals: policySignals
    };
  }

  _selectionFromAssessment(input, signals, source) {
    const assessment = this._normalizeAssessment(input);
    const risk = this._assessRiskFromAssessment(assessment);
    const hotfix = assessment.changeKind === 'hotfix' || this._matchShortCircuit(signals)?.name === 'hotfix';
    const governance = hotfix && risk !== 'high'
      ? 'standard'
      : this._assessGovernance(assessment, risk);
    const hotfixProfile = hotfix && governance !== 'structured';
    const policySignals = { ...signals, risk, governance, profile: hotfixProfile ? 'hotfix' : governance };
    const selectedIds = hotfixProfile
      ? ['approved', 'executing', 'verification']
      : this._selectByPolicy(governance, policySignals);
    const steps = this._validateAndFix(selectedIds, policySignals, {
      skipClosure: governance === 'lightweight',
      skipGate: governance === 'lightweight',
      skipMandatory: governance === 'lightweight'
    });
    return {
      steps,
      source,
      reasoning: this._buildPolicyReasoning(assessment, risk, governance),
      risk,
      governance,
      assessment,
      signals: policySignals
    };
  }

  // ── 信号收集 ─────────────────────────────────────────────

  _collectSignals(userRequest) {
    const text = (userRequest || '').toLowerCase();
    return {
      rawText: userRequest || '',
      keywords: this._extractKeywords(text),
      fileScope: this._estimateFileScope(text),
      moduleCount: null,
      hasTestsImpact: /test|测试/.test(text),
      hasSpecExists: this._specExists(),
      hasSpecAndReqs: this._specAndReqsExist(),
      hasRootCause: ROOT_CAUSE_RE.test(text),
      inWorktree: this._isInWorktree(),
      optionalTriggers: this._detectOptionalTriggers(text)
    };
  }

  _detectOptionalTriggers(text) {
    const triggers = {};
    for (const [step, kws] of Object.entries(OPTIONAL_SIGNALS)) {
      triggers[step] = kws.some(kw => text.includes(kw.toLowerCase()));
    }
    return triggers;
  }

  _extractKeywords(text) {
    const all = [...RISK_KEYWORDS.high, ...RISK_KEYWORDS.medium, ...RISK_KEYWORDS.low];
    return all.filter(kw => text.includes(kw.toLowerCase()));
  }

  _estimateFileScope(text) {
    if (/单文件|single\s*file|typo|错别字/.test(text)) return 1;
    if (/跨模块|跨服务|architecture|架构/.test(text)) return 10;
    if (/多文件|多模块|multi/.test(text)) return 5;
    return null;
  }

  _specExists() {
    if (!this.specDir) return false;
    return existsSync(join(this.specDir, 'spec.md'));
  }

  _specAndReqsExist() {
    if (!this.specDir) return false;
    return existsSync(join(this.specDir, 'spec.md')) &&
           existsSync(join(this.specDir, 'requirements.json'));
  }

  _isInWorktree() {
    try {
      const gitDir = execSync('git rev-parse --git-dir', {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim();
      const commonDir = execSync('git rev-parse --git-common-dir', {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim();
      return resolve(this.projectRoot, gitDir) !== resolve(this.projectRoot, commonDir);
    } catch {
      return false;
    }
  }

  // ── 规则短路 ────────────────────────────────────────────

  _matchShortCircuit(signals) {
    const rules = this.workflow?.selection_rules?.short_circuits || [];
    for (const rule of rules) {
      if (this._ruleMatches(rule, signals)) return rule;
    }
    return null;
  }

  _ruleMatches(rule, signals) {
    const match = rule.match || {};
    if (match.keywords_any) {
      const hit = match.keywords_any.some(kw =>
        signals.rawText.toLowerCase().includes(kw.toLowerCase())
      );
      if (!hit) return false;
    }
    if (match.file_scope_max != null) {
      if (!Number.isInteger(signals.fileScope) || signals.fileScope > match.file_scope_max) {
        return false;
      }
    }
    if (match.has_root_cause != null && signals.hasRootCause !== match.has_root_cause) {
      return false;
    }
    return true;
  }

  // ── Assessment、风险与治理 ───────────────────────────────

  _normalizeAssessment(input) {
    const value = input && typeof input === 'object' ? input : {};
    const normalized = {};
    for (const field of IMPACT_FIELDS) {
      normalized[field] = IMPACT_VALUES[field].includes(value[field]) ? value[field] : 'unknown';
    }
    const scope = value.scope && typeof value.scope === 'object' ? value.scope : {};
    normalized.scope = {
      fileCount: this._normalizeCount(scope.fileCount),
      moduleCount: this._normalizeCount(scope.moduleCount),
      crossModule: CROSS_MODULE_VALUES.includes(scope.crossModule) ? scope.crossModule : 'unknown'
    };
    normalized.changeKind = CHANGE_KINDS.includes(value.changeKind) ? value.changeKind : 'unknown';
    normalized.confidence = CONFIDENCE_VALUES.includes(value.confidence) ? value.confidence : 'low';
    normalized.evidence = Array.isArray(value.evidence)
      ? value.evidence.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim())
      : [];
    return normalized;
  }

  _normalizeCount(value) {
    return Number.isInteger(value) && value >= 0 ? value : null;
  }

  _isCompleteAssessment(input) {
    if (!this._hasImpactAssessment(input)) return false;
    if (!input.scope || typeof input.scope !== 'object') return false;
    const validCount = value => value === null || (Number.isInteger(value) && value >= 0);
    if (!validCount(input.scope.fileCount) || !validCount(input.scope.moduleCount)) return false;
    if (!CROSS_MODULE_VALUES.includes(input.scope.crossModule)) return false;
    if (!CHANGE_KINDS.includes(input.changeKind)) return false;
    if (!CONFIDENCE_VALUES.includes(input.confidence)) return false;
    return Array.isArray(input.evidence) && input.evidence.some(item => typeof item === 'string' && item.trim());
  }

  _hasImpactAssessment(input) {
    if (!input || typeof input !== 'object') return false;
    return IMPACT_FIELDS.every(field => IMPACT_VALUES[field].includes(input[field]));
  }

  _assessRiskFromAssessment(assessment) {
    if (['migration', 'destructive'].includes(assessment.dataImpact) || assessment.securityImpact === 'changed') {
      return 'high';
    }
    if (IMPACT_FIELDS.some(field => assessment[field] === 'unknown')) return 'medium';
    if (assessment.runtimeBehavior === 'changed' ||
        assessment.dataImpact === 'changed' ||
        assessment.deploymentImpact === 'changed' ||
        assessment.publicApiImpact === 'changed' ||
        assessment.dependencyImpact === 'changed') {
      return 'medium';
    }
    return 'low';
  }

  _assessGovernance(assessment, risk = this._assessRiskFromAssessment(assessment)) {
    if (risk === 'high' ||
        assessment.publicApiImpact === 'changed' ||
        ['feature', 'refactor'].includes(assessment.changeKind) ||
        assessment.scope.crossModule === 'yes') {
      return 'structured';
    }
    if (assessment.changeKind === 'hotfix') return 'standard';
    if (risk === 'low' &&
        assessment.changeKind === 'chore' &&
        assessment.confidence === 'high' &&
        assessment.evidence.length > 0 &&
        Number.isInteger(assessment.scope.fileCount) &&
        Number.isInteger(assessment.scope.moduleCount) &&
        assessment.scope.crossModule === 'no') {
      return 'lightweight';
    }
    return 'standard';
  }

  _assessLegacyRisk(signals) {
    const keywords = signals?.keywords || [];
    if (keywords.some(k => RISK_KEYWORDS.high.includes(k))) return 'high';
    if (signals?.fileScope >= 5) return 'high';
    if (keywords.some(k => RISK_KEYWORDS.medium.includes(k))) return 'medium';
    if (keywords.some(k => RISK_KEYWORDS.low.includes(k))) return 'low';
    return 'medium';
  }

  // ── 规则兜底 ─────────────────────────────────────────────

  _ruleBasedFallback(signals) {
    const legacyRisk = this._assessLegacyRisk(signals);
    const risk = legacyRisk === 'high' ? 'high' : 'medium';
    const governance = risk === 'high' ? 'structured' : 'standard';
    return {
      name: `${risk}-risk`,
      steps: this._selectByPolicy(governance, signals),
      reasoning: `未获得完整 assessment，按兼容信号保守选择 ${risk} 风险、${governance} 治理`,
      risk,
      governance
    };
  }

  _selectByPolicy(governance, signals) {
    if (governance === 'lightweight') return ['executing', 'verification'];
    if (governance === 'standard') {
      return ['planning', 'approved', 'executing', 'verification', 'code-review-request', 'review-gate', 'code-review-response', 'synced'];
    }
    const steps = [];
    if (!signals?.hasSpecAndReqs) steps.push('brainstorming');
    steps.push('detail-expansion', 'planning', 'analyze-artifacts', 'approved');
    if (!signals?.inWorktree) steps.push('git-worktree');
    steps.push('executing', 'converge', 'verification', 'code-review-request', 'review-gate', 'code-review-response', 'synced');
    return steps;
  }

  _buildPolicyReasoning(assessment, risk, governance) {
    const impacts = IMPACT_FIELDS.filter(field => assessment[field] !== 'none')
      .map(field => `${field}=${assessment[field]}`);
    const scope = assessment.scope.crossModule === 'yes' ? ['crossModule=yes'] : [];
    const facts = [...impacts, ...scope, `changeKind=${assessment.changeKind}`];
    return `确定性策略判定为 ${risk} 风险、${governance} 治理；依据: ${facts.join(', ')}`;
  }

  // ── AI assessment（可选注入 aiClient）───────────────────

  async _aiAssess(userRequest, signals) {
    if (!this.aiClient) return null;
    const prompt = this._buildAIPrompt(userRequest, signals);
    const response = await this.aiClient.complete(prompt);
    return this._parseAIResponse(response);
  }

  _buildAIPrompt(userRequest, signals) {
    return [
      'Extract engineering facts for a pipeline policy. Do not choose risk, governance, or steps.',
      '',
      'User request:',
      userRequest,
      '',
      'Signals:',
      JSON.stringify(signals, null, 2),
      '',
      'Output only JSON with runtimeBehavior, dataImpact, securityImpact, deploymentImpact,',
      'publicApiImpact, dependencyImpact, scope { fileCount, moduleCount, crossModule },',
      'changeKind, confidence, and evidence. Use "unknown" when the request does not prove a fact.'
    ].join('\n');
  }

  _parseAIResponse(response) {
    try {
      const match = response.match(/\{[\s\S]*\}/);
      if (!match) return null;
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }

  // ── pipeline-plan.md 读写 ───────────────────────────────

  /**
   * 把选择结果写成 pipeline-plan.md
   * @param {object} selection - select() 返回值
   * @returns {{ path: string, content: string }}
   */
  writePipelinePlan(selection) {
    if (!this.specDir) throw new Error('specDir is required to write pipeline-plan.md');
    const content = this._renderPipelinePlan(selection);
    const path = join(this.specDir, 'pipeline-plan.md');
    mkdirSync(this.specDir, { recursive: true });
    writeFileSync(path, content, 'utf-8');
    return { path, content };
  }

  /**
   * 读 pipeline-plan.md 并解析为 steps
   * @returns {object[]|null} 步骤对象数组，或 null（文件不存在/无步骤段）
   */
  readPipelinePlan() {
    if (!this.specDir) return null;
    const path = join(this.specDir, 'pipeline-plan.md');
    if (!existsSync(path)) return null;
    const content = readFileSync(path, 'utf-8');

    const stepsSection = this._extractSection(content, '选择步骤');
    if (!stepsSection) return null;

    const catalog = this.workflow?.step_catalog || {};
    const ids = [];
    const lines = stepsSection.split('\n');
    for (const line of lines) {
      const m = line.match(/^\s*\d+\.\s*\*?\*?([a-z][a-z0-9-]*)\*?\*?\s*[—\-]/i);
      if (m) ids.push(m[1]);
    }

    const declaredGovernance = content.match(/^\s*-\s*治理级别:\s*(lightweight|standard|structured)\s*$/mi)?.[1];
    if (!declaredGovernance) {
      const signals = { ...this._collectSignals(''), governance: 'legacy', profile: 'legacy' };
      return this._validateAndFix(ids, signals, {
        skipClosure: true,
        skipGate: true,
        skipMandatory: true
      });
    }

    const governance = declaredGovernance;
    const profile = content.match(/^\s*-\s*策略配置:\s*([a-z][a-z0-9-]*)\s*$/mi)?.[1] || governance;
    const signals = { ...this._collectSignals(''), governance, profile };
    return this._validateAndFix(ids, signals, {
      skipClosure: governance === 'lightweight',
      skipGate: governance === 'lightweight',
      skipMandatory: governance === 'lightweight'
    });
  }

  _extractSection(content, heading) {
    const re = new RegExp(`##\\s+${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`);
    const m = content.match(re);
    return m ? m[1].trim() : null;
  }

  _renderPipelinePlan(selection) {
    const s = selection.signals || {};
    const assessment = selection.assessment || {};
    const lines = [];
    lines.push('# Pipeline Plan');
    lines.push('');
    lines.push('> Auto-generated by loom-pipeline-selector. Do not edit manually.');
    lines.push(`> 生成时间: ${new Date().toISOString()}`);
    lines.push('');
    lines.push('## 用户需求');
    lines.push('');
    lines.push(s.rawText || '(未提供)');
    lines.push('');
    lines.push('## 选择分析');
    lines.push('');
    lines.push(`- 风险等级: ${selection.risk}`);
    lines.push(`- 治理级别: ${selection.governance || 'unknown'}`);
    lines.push(`- 策略配置: ${s.profile || selection.governance || 'unknown'}`);
    lines.push(`- Assessment 来源: ${selection.source}`);
    lines.push(`- 关键词: ${(s.keywords || []).join(', ') || '(无)'}`);
    lines.push(`- 影响文件: ${assessment.scope?.fileCount ?? s.fileScope ?? 'unknown'}`);
    lines.push(`- 影响模块: ${assessment.scope?.moduleCount ?? s.moduleCount ?? 'unknown'}`);
    lines.push(`- 跨模块: ${assessment.scope?.crossModule || 'unknown'}`);
    lines.push(`- 变更类型: ${assessment.changeKind || 'unknown'}`);
    lines.push(`- 证据: ${assessment.evidence?.join('；') || '(无)'}`);
    lines.push(`- 已有 spec.md: ${s.hasSpecExists ? '是' : '否'}`);
    lines.push(`- 已有 spec.md + requirements.json: ${s.hasSpecAndReqs ? '是' : '否'}`);
    lines.push(`- 已在 worktree: ${s.inWorktree ? '是' : '否'}`);
    lines.push(`- 根因明确: ${s.hasRootCause ? '是' : '否'}`);
    lines.push('');
    lines.push('## 选择步骤');
    lines.push('');
    selection.steps.forEach((step, i) => {
      lines.push(`${i + 1}. **${step.id}** — ${step.description || '(无描述)'}`);
      if (step.skill) lines.push(`   - skill: \`${step.skill}\``);
      if (step.requires?.length) lines.push(`   - requires: ${step.requires.join(', ')}`);
      if (step.outputs?.length) lines.push(`   - outputs: ${step.outputs.join(', ')}`);
    });
    lines.push('');
    lines.push('## 来源');
    lines.push('');
    lines.push(selection.source);
    lines.push('');
    lines.push('## 理由');
    lines.push('');
    lines.push(selection.reasoning);
    lines.push('');
    lines.push('## 下一步');
    lines.push('');
    lines.push(`- 确认方案：\`loom run --spec-dir ${this.specDir} --approve-pipeline\``);
    lines.push(`- 调整步骤：手动编辑本文件后执行 \`loom run --spec-dir ${this.specDir} --approve-pipeline\``);
    lines.push('');
    return lines.join('\n');
  }

  // ── 校验与修正 ───────────────────────────────────────────

  _validateAndFix(stepIds, signals, { skipClosure = false, skipGate = false, skipMandatory = false } = {}) {
    const catalog = this.workflow?.step_catalog;
    if (!catalog) {
      return stepIds.map(id => ({ id }));
    }

    const rules = this.workflow?.selection_rules || {};
    const mustInclude = rules.must_include || [];
    const maxSteps = rules.max_steps || 10;

    let ids = [...new Set(stepIds)];

    for (const m of mustInclude) {
      if (!ids.includes(m)) ids.push(m);
    }

    if (!skipMandatory) {
      ids = this._ensureMandatorySteps(ids, signals, catalog);
    }

    if (!skipClosure) {
      ids = this._ensureDependencyClosure(ids, signals);
    }
    if (!skipGate) {
      ids = this._ensureGate(ids, signals);
    }
    ids = this._sortSteps(ids);

    // optional 模块（catalog 标注 optional: true）不计入 max_steps。
    // mandatory 步骤始终计入，避免质量门禁被裁掉。
    const nonOptionalCount = ids.filter(id => !catalog[id]?.optional).length;
    if (nonOptionalCount > maxSteps) {
      ids = this._trimOptionals(ids, maxSteps, catalog);
      const finalNonOptional = ids.filter(id => !catalog[id]?.optional).length;
      if (finalNonOptional > maxSteps) {
        throw new Error(`Selected steps exceed max_steps (${maxSteps}): ${finalNonOptional} non-optional / ${ids.length} total [${ids.join(',')}]`);
      }
    }

    return ids.map(id => this._stepFromCatalog(id, catalog, {
      governance: signals?.governance || (skipClosure ? 'lightweight' : 'structured'),
      profile: signals?.profile
    }));
  }

  _stepFromCatalog(id, catalog = this.workflow?.step_catalog || {}, { governance = 'structured', profile = governance } = {}) {
    const def = catalog[id] || {};
    const lightweight = governance === 'lightweight';
    const standard = governance === 'standard';
    const hotfix = profile === 'hotfix';
    const requires = hotfix && id === 'executing'
      ? []
      : lightweight && id === 'executing'
      ? []
      : lightweight && id === 'verification'
        ? ['test-report.md']
        : standard && id === 'planning'
          ? []
          : standard && id === 'executing'
            ? ['plan.md', 'tasks/']
            : standard && id === 'verification'
              ? ['test-report.md']
        : def.requires || [];
    const outputs = hotfix && id === 'executing'
      ? ['test-report.md', 'handoffs/executing.json']
      : standard && id === 'planning'
        ? ['plan.md', 'tasks/', 'handoffs/planning.json']
      : standard && id === 'executing'
        ? ['test-report.md', 'handoffs/executing.json']
      : lightweight && id === 'executing'
      ? ['handoffs/executing.json']
      : def.outputs || [];
    const validators = standard && id === 'planning'
      ? []
      : lightweight && id === 'executing'
      ? []
      : def.validators || [];
    const gateVerdict = lightweight && id === 'executing'
      ? undefined
      : def.gate_verdict;
    const evidenceRequired = lightweight && id === 'executing'
      ? false
      : def.evidence_required === true;
    return {
      id,
      skill: def.skill ?? null,
      requires,
      outputs,
      validators,
      gate: def.gate ?? (id === 'approved' ? 'human-approval' : undefined),
      gate_verdict: gateVerdict,
      evidence_required: evidenceRequired,
      approval_requires: def.approval_requires || [],
      mandatory: def.mandatory === true,
      mandatory_for: def.mandatory_for || [],
      optional: def.optional === true,
      description: def.description || ''
    };
  }

  _ensureMandatorySteps(ids, signals, catalog) {
    const result = [...ids];
    const governance = signals?.governance;
    for (const [id, def] of Object.entries(catalog || {})) {
      const mandatory = def?.mandatory === true || (def?.mandatory_for || []).includes(governance);
      if (!mandatory || result.includes(id)) continue;
      result.push(id);
    }
    return result;
  }

  _ensureDependencyClosure(ids, signals) {
    const catalog = this.workflow?.step_catalog || {};
    const result = [...ids];
    let changed = true;
    let iterations = 0;

    while (changed && iterations < 10) {
      changed = false;
      iterations++;
      for (const id of [...result]) {
        const def = this._stepFromCatalog(id, catalog, {
          governance: signals?.governance || 'structured',
          profile: signals?.profile
        });
        if (!def?.requires) continue;
        for (const req of def.requires) {
          if (this._fileExists(req)) continue;
          const producer = this._findProducer(req, catalog);
          if (producer && !result.includes(producer)) {
            result.push(producer);
            changed = true;
          }
        }
      }
    }
    return result;
  }

  _fileExists(filename) {
    if (!this.specDir) return false;
    return existsSync(join(this.specDir, filename));
  }

  _findProducer(filename, catalog) {
    for (const [id, def] of Object.entries(catalog)) {
      if (def.outputs?.includes(filename)) return id;
    }
    return null;
  }

  _ensureGate(ids, signals) {
    if (ids.includes('approved')) return ids;
    if (!ids.includes('planning')) return ids;

    const result = [];
    for (const id of ids) {
      result.push(id);
      if (id === 'planning') {
        result.push('approved');
      }
    }
    return result;
  }

  _sortSteps(ids) {
    return ids.sort((a, b) => {
      const ia = STEP_ORDER.indexOf(a);
      const ib = STEP_ORDER.indexOf(b);
      if (ia < 0 && ib < 0) return 0;
      if (ia < 0) return 1;
      if (ib < 0) return -1;
      return ia - ib;
    });
  }

  // optional 模块裁剪优先级（越靠前越先被裁掉）：
  //   detail-expansion → analyze-artifacts → converge
  //   converge 最靠近验证关口、价值最高，最后裁。
  //   omission-hunter 由 converge 内部触发，不作为独立 step 裁剪。
  static OPTIONAL_TRIM_ORDER = ['detail-expansion', 'analyze-artifacts', 'converge'];

  _trimOptionals(ids, maxSteps, catalog) {
    const optionalIds = new Set(
      Object.entries(catalog || {})
        .filter(([, def]) => def?.optional === true)
        .map(([id]) => id)
    );
    let result = [...ids];
    for (const candidate of PipelineSelector.OPTIONAL_TRIM_ORDER) {
      if (result.length <= maxSteps) break;
      if (!optionalIds.has(candidate)) continue;
      const idx = result.indexOf(candidate);
      if (idx < 0) continue;
      result.splice(idx, 1);
    }
    return result;
  }
}
