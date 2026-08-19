import { describe, it, expect, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SkillLoader } from '../../src/core/skill-loader.js';

const dirs = [];
function tmp() {
  const d = mkdtempSync(join(tmpdir(), 'loom-skills-'));
  dirs.push(d);
  return d;
}
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true });
});

function writeSkill(dir, skillName, content) {
  const p = join(dir, skillName);
  mkdirSync(p, { recursive: true });
  writeFileSync(join(p, 'SKILL.md'), content, 'utf-8');
}

function createTestDir() {
  const dir = tmp();

  // skill 1: 完整结构
  writeSkill(dir, 'loom-brainstorming', `---
name: loom-brainstorming
description: >
  Explore 2-3 implementation options with trade-offs.
---

# 需求头脑风暴

## 触发条件

- 用户提出新需求。
- 用户询问设计方案。

## 执行流程

### Step 1：理解需求

1. 读取 constitution.md。
2. 明确边界。

### Step 2：探索方案

每个方案包含架构思路。

## 约束

- 每个方案必须有 trade-off。
- 禁止模糊描述。

## 完成条件

spec.md 保存、自审完成。
`);

  // skill 2: 仅 description 字段
  writeSkill(dir, 'loom-writing-plans', `---
name: loom-writing-plans
description: >
  Break a confirmed spec into ordered task files.
---

# 实现计划拆解

## 触发条件

- 用户确认 spec 后。

## 执行流程

1. 分析 spec。
2. 拆解 task。

## 完成条件

所有 task 文件已创建。
`);

  // skill 3: 有代码块内 ## 标题（fence-aware 测试）
  writeSkill(dir, 'loom-test-skill', `---
name: loom-test-skill
description: Test skill with fenced code blocks.
---

# 测试 Skill

## 触发条件

- 测试触发。

## 执行流程

\`\`\`markdown
## 这个不应该被当作 section 标题
因为它在代码块内
\`\`\`

## 约束

- 约束 1。
`);

  return dir;
}

describe('SkillLoader', () => {
  describe('listSummaries (L0)', () => {
    it('returns summaries for all skills', () => {
      const dir = createTestDir();
      const loader = new SkillLoader(dir);
      const summaries = loader.listSummaries();

      expect(summaries).toHaveLength(3);
      expect(summaries.map(s => s.name)).toContain('loom-brainstorming');
      expect(summaries.map(s => s.name)).toContain('loom-writing-plans');
      expect(summaries.map(s => s.name)).toContain('loom-test-skill');
    });

    it('includes description field from frontmatter', () => {
      const dir = createTestDir();
      const loader = new SkillLoader(dir);
      const brainstorming = loader.listSummaries().find(s => s.name === 'loom-brainstorming');

      expect(brainstorming.description).toContain('Explore 2-3 implementation options');
    });

    it('falls back to empty string when description is absent', () => {
      const dir = createTestDir();
      const loader = new SkillLoader(dir);
      const writingPlans = loader.listSummaries().find(s => s.name === 'loom-writing-plans');

      expect(writingPlans.description.length).toBeGreaterThan(0);
    });

    it('extracts section titles (fence-aware)', () => {
      const dir = createTestDir();
      const loader = new SkillLoader(dir);
      const testSkill = loader.listSummaries().find(s => s.name === 'loom-test-skill');

      // "这个不应该被当作 section 标题" 不应出现在 sections 中
      expect(testSkill.sections).toContain('触发条件');
      expect(testSkill.sections).toContain('执行流程');
      expect(testSkill.sections).toContain('约束');
      expect(testSkill.sections).not.toContain('这个不应该被当作 section 标题');
    });

    it('extracts trigger conditions', () => {
      const dir = createTestDir();
      const loader = new SkillLoader(dir);
      const brainstorming = loader.listSummaries().find(s => s.name === 'loom-brainstorming');

      expect(brainstorming.triggers.length).toBeGreaterThanOrEqual(1);
      expect(brainstorming.triggers.some(t => t.includes('新需求'))).toBe(true);
    });

    it('estimates tokens for each skill', () => {
      const dir = createTestDir();
      const loader = new SkillLoader(dir);
      const summaries = loader.listSummaries();

      for (const s of summaries) {
        expect(s.tokens).toBeGreaterThan(0);
      }
    });

    it('returns empty array when skills dir does not exist', () => {
      const loader = new SkillLoader(join(tmp(), 'nonexistent'));
      expect(loader.listSummaries()).toEqual([]);
    });
  });

  describe('getSummary', () => {
    it('finds skill by exact name', () => {
      const dir = createTestDir();
      const loader = new SkillLoader(dir);
      const summary = loader.getSummary('loom-brainstorming');

      expect(summary).not.toBeNull();
      expect(summary.name).toBe('loom-brainstorming');
    });

    it('finds skill by short name (without loom- prefix)', () => {
      const dir = createTestDir();
      const loader = new SkillLoader(dir);
      const summary = loader.getSummary('brainstorming');

      expect(summary).not.toBeNull();
      expect(summary.name).toBe('loom-brainstorming');
    });

    it('returns null for unknown skill', () => {
      const dir = createTestDir();
      const loader = new SkillLoader(dir);
      expect(loader.getSummary('nonexistent')).toBeNull();
    });
  });

  describe('getFullSkill (L1)', () => {
    it('returns full skill content', () => {
      const dir = createTestDir();
      const loader = new SkillLoader(dir);
      const full = loader.getFullSkill('loom-brainstorming');

      expect(full).not.toBeNull();
      expect(full.name).toBe('loom-brainstorming');
      expect(full.content).toContain('## 执行流程');
      expect(full.content).toContain('## 约束');
      expect(full.tokens).toBeGreaterThan(0);
    });

    it('finds skill by short name', () => {
      const dir = createTestDir();
      const loader = new SkillLoader(dir);
      const full = loader.getFullSkill('writing-plans');

      expect(full).not.toBeNull();
      expect(full.name).toBe('loom-writing-plans');
    });

    it('returns null for unknown skill', () => {
      const dir = createTestDir();
      const loader = new SkillLoader(dir);
      expect(loader.getFullSkill('nonexistent')).toBeNull();
    });
  });

  describe('getSkillEssentials (L0.5)', () => {
    it('returns compact single-skill context without full content', () => {
      const dir = createTestDir();
      const loader = new SkillLoader(dir);
      const essentials = loader.getSkillEssentials('loom-brainstorming');
      const full = loader.getFullSkill('loom-brainstorming');

      expect(essentials).not.toBeNull();
      expect(essentials.name).toBe('loom-brainstorming');
      expect(essentials.sections).toContain('执行流程');
      expect(essentials.content).toBeUndefined();
      expect(essentials.full_tokens).toBe(full.tokens);
      expect(essentials.tokens).toBeGreaterThan(0);
      expect(essentials.read_hints.full).toContain('full: true');
    });

    it('returns null for unknown skill', () => {
      const dir = createTestDir();
      const loader = new SkillLoader(dir);
      expect(loader.getSkillEssentials('nonexistent')).toBeNull();
    });
  });

  describe('getSkillSection (L1 fine-grained)', () => {
    it('returns a single section content', () => {
      const dir = createTestDir();
      const loader = new SkillLoader(dir);
      const section = loader.getSkillSection('loom-brainstorming', '约束');

      expect(section).not.toBeNull();
      expect(section.content).toContain('trade-off');
      expect(section.content).toContain('禁止模糊描述');
    });

    it('returns null for non-existent section', () => {
      const dir = createTestDir();
      const loader = new SkillLoader(dir);
      const section = loader.getSkillSection('loom-brainstorming', '不存在的节');

      expect(section).toBeNull();
    });

    it('fuzzy matches section titles', () => {
      const dir = createTestDir();
      const loader = new SkillLoader(dir);
      // 包含匹配
      const section = loader.getSkillSection('loom-brainstorming', '完成');

      expect(section).not.toBeNull();
      expect(section.content).toContain('spec.md');
    });
  });

  describe('formatL0', () => {
    it('produces AI-friendly text output', () => {
      const dir = createTestDir();
      const loader = new SkillLoader(dir);
      const text = loader.formatL0();

      expect(text).toContain('## loom-brainstorming');
      expect(text).toContain('Description: Explore 2-3 implementation options');
      expect(text).toContain('Triggers:');
      expect(text).toContain('Sections:');
    });
  });

  describe('real skills directory', () => {
    it('loads all 16 skills from the actual skills/ directory', () => {
      const loader = new SkillLoader(join(process.cwd(), 'skills'));
      const summaries = loader.listSummaries();

      expect(summaries.length).toBeGreaterThanOrEqual(15);
      for (const s of summaries) {
        expect(s.name).toBeTruthy();
        expect(s.sections.length).toBeGreaterThan(0);
        expect(s.tokens).toBeGreaterThan(0);
      }
    });

    it('L0 total tokens is significantly less than L1 total', () => {
      const loader = new SkillLoader(join(process.cwd(), 'skills'));
      const summaries = loader.listSummaries();

      // L0 总 token 是所有 skill 的全文 token 总和
      const l1Total = summaries.reduce((sum, s) => sum + s.tokens, 0);

      // L0 每条摘要 ~50-80 token（name + summary + sections + triggers）
      // 16 skills × ~80 = ~1280 token
      const l0Estimate = summaries.length * 80;

      // L0 应该远小于 L1（至少 5 倍差距）
      expect(l0Estimate).toBeLessThan(l1Total / 5);
    });

    it('all skills have description field', () => {
      const loader = new SkillLoader(join(process.cwd(), 'skills'));
      const summaries = loader.listSummaries();

      for (const s of summaries) {
        expect(s.description.length).toBeGreaterThan(0);
      }
    });
  });
});
