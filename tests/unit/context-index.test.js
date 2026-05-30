import { describe, it, expect } from 'vitest';
import { ContextIndex, estimateTokens, resolveDocPath, DOC_KEYS, SECTION_TOKEN_BUDGET } from '../../src/core/context-index.js';

const SAMPLE = `# 项目宪章

前言段落。

## 核心原则

1. 分层架构
2. DI

## 编码红线

禁止硬编码配置值。
`;

describe('ContextIndex parsing', () => {
  it('extracts H1 title, preamble and ## sections', () => {
    const idx = new ContextIndex(SAMPLE, 'constitution');
    expect(idx.title).toBe('项目宪章');
    expect(idx.preamble).toBe('前言段落。');
    expect(idx.sections.map(s => s.title)).toEqual(['核心原则', '编码红线']);
  });

  it('outline (L0) carries titles + token estimates but no body', () => {
    const idx = new ContextIndex(SAMPLE);
    const out = idx.outline();
    expect(out.section_count).toBe(2);
    expect(out.sections[0]).toHaveProperty('tokens');
    expect(out.sections[0]).not.toHaveProperty('content');
    expect(out.sections[0]).not.toHaveProperty('_body');
  });

  it('getSection (L1) returns full body by exact title', () => {
    const idx = new ContextIndex(SAMPLE);
    const sec = idx.getSection('编码红线');
    expect(sec.content).toContain('禁止硬编码');
  });

  it('getSection matches case-insensitively and partially', () => {
    const idx = new ContextIndex('# T\n\n## Coding Redlines\n\nno hardcode\n');
    expect(idx.getSection('coding').title).toBe('Coding Redlines');
    expect(idx.getSection('REDLINES').title).toBe('Coding Redlines');
  });

  it('getSection returns null for unknown/empty query', () => {
    const idx = new ContextIndex(SAMPLE);
    expect(idx.getSection('nope')).toBeNull();
    expect(idx.getSection('')).toBeNull();
  });

  it('flags oversized sections beyond the token budget', () => {
    const big = '# T\n\n## Big\n\n' + 'x'.repeat(SECTION_TOKEN_BUDGET * 3 + 100) + '\n';
    const idx = new ContextIndex(big);
    expect(idx.outline().sections[0].oversized).toBe(true);
  });

  it('handles empty / no-heading input gracefully', () => {
    const idx = new ContextIndex('');
    expect(idx.sections).toEqual([]);
    expect(idx.outline().section_count).toBe(0);
  });

  it('does not split on ## lines inside fenced code blocks', () => {
    const md = '# T\n\n## 目录结构\n\n```\nsrc/\n## not a heading\napp/\n```\n\n## 架构模式\n\nMVC。\n';
    const idx = new ContextIndex(md);
    expect(idx.sections.map(s => s.title)).toEqual(['目录结构', '架构模式']);
    expect(idx.getSection('目录结构').content).toContain('## not a heading');
  });
});

describe('helpers', () => {
  it('estimateTokens grows with length and is zero for empty', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abcdef')).toBeGreaterThan(0);
  });

  it('resolveDocPath maps known keys and rejects unknown', () => {
    expect(resolveDocPath('/x/.loom', 'constitution')).toMatch(/constitution\.md$/);
    expect(resolveDocPath('/x/.loom', 'bogus')).toBeNull();
    expect(DOC_KEYS).toContain('memory');
  });
});
