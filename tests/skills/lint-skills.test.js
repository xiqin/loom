import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { lintSkills } from '../../skills/loom-writing-skills/scripts/lint-skills.mjs';

const ROOT = join(import.meta.dirname, '..', '..');
const TMP_ROOT = join(import.meta.dirname, '__test_lint_skills__');

afterEach(() => {
  rmSync(TMP_ROOT, { recursive: true, force: true });
});

describe('lint-skills script', () => {
  it('passes the repository skills', () => {
    const result = lintSkills({ root: ROOT });
    expect(result.errors).toEqual([]);
    expect(result.skills).toContain('loom-writing-skills');
  });

  it('detects missing referenced files and malformed evals', () => {
    const skillDir = join(TMP_ROOT, 'skills', 'loom-bad-skill');
    mkdirSync(join(skillDir, 'evals'), { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), `---
name: loom-bad-skill
description: >
  Broken skill.
---

# Bad Skill

Read \`references/missing.md\`.
`);
    writeFileSync(join(skillDir, 'evals', 'triggers.json'), JSON.stringify({
      version: 1,
      skill: 'loom-other',
      positive: [],
      negative: []
    }));

    const result = lintSkills({ root: TMP_ROOT });
    expect(result.ok).toBe(false);
    expect(result.errors.some(error => error.includes('missing referenced file'))).toBe(true);
    expect(result.errors.some(error => error.includes('evals skill must match'))).toBe(true);
    expect(existsSync(skillDir)).toBe(true);
  });

  it('rejects legacy REFERENCE casing', () => {
    const skillDir = join(TMP_ROOT, 'skills', 'loom-legacy-skill');
    mkdirSync(join(skillDir, 'REFERENCE'), { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), `---
name: loom-legacy-skill
description: >
  Legacy skill.
  Use when: testing reference casing.
---

# Legacy Skill

Read \`REFERENCE/details.md\`.
`);

    const result = lintSkills({ root: TMP_ROOT });
    expect(result.ok).toBe(false);
    expect(result.errors.some(error => error.includes('reference directory must be named references'))).toBe(true);
    expect(result.errors.some(error => error.includes('use references/ path casing'))).toBe(true);
  });
});
