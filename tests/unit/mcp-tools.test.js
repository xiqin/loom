import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { executeToolCall, TOOL_DEFINITIONS } from '../../src/mcp/tools.js';
import { SessionStore } from '../../src/mcp/session-store.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'loom-mcp-')); }

describe('MCP tool definitions', () => {
  it('exposes the documented tools incl. context + capabilities', () => {
    expect(TOOL_DEFINITIONS).toHaveLength(10);
    const names = TOOL_DEFINITIONS.map(t => t.name);
    expect(names).toContain('loom_attach_spec');
    expect(names).toContain('loom_get_context');
    expect(names).toContain('loom_list_capabilities');
  });

  it('every tool carries a group tag for capability grouping', () => {
    for (const t of TOOL_DEFINITIONS) {
      expect(typeof t.group).toBe('string');
      expect(t.group.length).toBeGreaterThan(0);
    }
  });
});

describe('loom_list_capabilities (② virtual-skill grouping)', () => {
  it('returns grouped catalog and hides retrieval group without codegraph', () => {
    const root = tmp();
    const store = new SessionStore();
    const r = executeToolCall('loom_list_capabilities', { project_root: root }, store, 's1');
    expect(r.codegraph_available).toBe(false);
    const groups = r.groups.map(g => g.group);
    expect(groups).toContain('context');
    expect(groups).toContain('pipeline');
    expect(groups).not.toContain('retrieval');
  });

  it('exposes retrieval group when .codegraph/ exists', () => {
    const root = tmp();
    mkdirSync(join(root, '.codegraph'), { recursive: true });
    const store = new SessionStore();
    const r = executeToolCall('loom_list_capabilities', { project_root: root }, store, 's1');
    expect(r.codegraph_available).toBe(true);
    expect(r.groups.map(g => g.group)).toContain('retrieval');
  });
});

describe('loom_get_context (① progressive disclosure)', () => {
  function seedConstitution(root) {
    const rulesDir = join(root, '.loom', 'rules');
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(join(rulesDir, 'constitution.md'),
      '# 项目宪章\n\n## 核心原则\n分层架构。\n\n## 编码红线\n禁止硬编码。\n');
  }

  it('returns outline (L0) when no section given', () => {
    const root = tmp();
    seedConstitution(root);
    const store = new SessionStore();
    const r = executeToolCall('loom_get_context', { doc: 'constitution', project_root: root }, store, 's1');
    expect(r.title).toBe('项目宪章');
    expect(r.sections.map(s => s.title)).toEqual(['核心原则', '编码红线']);
    expect(r.sections.every(s => typeof s.tokens === 'number')).toBe(true);
    expect(r.content).toBeUndefined();
  });

  it('returns a single section full text (L1) when section given', () => {
    const root = tmp();
    seedConstitution(root);
    const store = new SessionStore();
    const r = executeToolCall('loom_get_context', { doc: 'constitution', section: '编码红线', project_root: root }, store, 's1');
    expect(r.title).toBe('编码红线');
    expect(r.content).toContain('禁止硬编码');
  });

  it('errors with available_sections on unknown section', () => {
    const root = tmp();
    seedConstitution(root);
    const store = new SessionStore();
    const r = executeToolCall('loom_get_context', { doc: 'constitution', section: '不存在', project_root: root }, store, 's1');
    expect(r.error).toMatch(/not found/);
    expect(r.available_sections).toContain('核心原则');
  });

  it('errors when doc file missing', () => {
    const root = tmp();
    const store = new SessionStore();
    const r = executeToolCall('loom_get_context', { doc: 'constitution', project_root: root }, store, 's1');
    expect(r.error).toMatch(/not found/);
  });

  it('auto-falls back to full when doc has no ## sections (L0)', () => {
    const root = tmp();
    const rulesDir = join(root, '.loom', 'rules');
    mkdirSync(rulesDir, { recursive: true });
    // 仅前言、无任何 ## 节 — outline 会空
    writeFileSync(join(rulesDir, 'constitution.md'), '# 宪章\n\n全部正文都在这里，没有二级标题。\n');
    const store = new SessionStore();
    const r = executeToolCall('loom_get_context', { doc: 'constitution', project_root: root }, store, 's1');
    expect(r.fallback).toBe('no-sections');
    expect(r.content).toContain('全部正文都在这里');
    expect(r.sections).toBeUndefined();
  });

  it('auto-falls back to full when requesting a section in an unstructured doc', () => {
    const root = tmp();
    const rulesDir = join(root, '.loom', 'rules');
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(join(rulesDir, 'constitution.md'), '# 宪章\n\n没有分节。\n');
    const store = new SessionStore();
    const r = executeToolCall('loom_get_context', { doc: 'constitution', section: '任意', project_root: root }, store, 's1');
    expect(r.fallback).toBe('no-sections');
    expect(r.content).toContain('没有分节');
  });

  it('full:true returns whole raw file (fallback)', () => {
    const root = tmp();
    seedConstitution(root);
    const store = new SessionStore();
    const r = executeToolCall('loom_get_context', { doc: 'constitution', full: true, project_root: root }, store, 's1');
    expect(r.content).toContain('# 项目宪章');
    expect(r.content).toContain('核心原则');
    expect(r.content).toContain('编码红线');
  });

  it('LOOM_CONTEXT_FULL env forces whole file over outline', () => {
    const root = tmp();
    seedConstitution(root);
    const store = new SessionStore();
    process.env.LOOM_CONTEXT_FULL = '1';
    try {
      const r = executeToolCall('loom_get_context', { doc: 'constitution', project_root: root }, store, 's1');
      expect(r.content).toContain('# 项目宪章');
      expect(r.sections).toBeUndefined();
    } finally {
      delete process.env.LOOM_CONTEXT_FULL;
    }
  });
});

describe('path sandboxing', () => {
  it('rejects spec_dir escaping project root', () => {
    const root = tmp();
    const store = new SessionStore();
    expect(() =>
      executeToolCall('loom_get_pipeline_context', { spec_dir: '../../etc', project_root: root }, store, 's1')
    ).toThrow(/escapes project root/);
  });

  it('rejects escape via update_task_state too', () => {
    const root = tmp();
    const store = new SessionStore();
    expect(() =>
      executeToolCall('loom_update_task_state',
        { spec_dir: '../../../tmp/evil', task_id: 'T1', status: 'done', project_root: root },
        store, 's1')
    ).toThrow(/escapes project root/);
  });
});

describe('happy path', () => {
  it('attach + project status', () => {
    const root = tmp();
    mkdirSync(join(root, 'specs'), { recursive: true });
    const store = new SessionStore();
    const att = executeToolCall('loom_attach_spec',
      { spec_dir: join(root, 'specs', 'x'), project_root: root }, store, 's1');
    expect(att.ok).toBe(true);
    const status = executeToolCall('loom_get_project_status', {}, store, 's1');
    expect(status.project_root).toBe(root);
    expect(Array.isArray(status.pipelines)).toBe(true);
  });

  it('update_task_state writes within sandbox', () => {
    const root = tmp();
    const specDir = join(root, 'specs', 'x');
    mkdirSync(specDir, { recursive: true });
    const store = new SessionStore();
    const r = executeToolCall('loom_update_task_state',
      { spec_dir: 'specs/x', task_id: 'T1', status: 'executing', project_root: root },
      store, 's1');
    expect(r.ok).toBe(true);
    expect(r.task.status).toBe('executing');
  });
});
