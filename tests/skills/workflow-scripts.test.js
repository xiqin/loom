import { describe, it, expect, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { validatePlan } from '../../skills/loom-writing-plans/scripts/validate-plan.mjs';
import { verifyArtifacts } from '../../skills/loom-verification-before-completion/scripts/verify-artifacts.mjs';
import { validateIndex } from '../../skills/loom-index-update/scripts/validate-index.mjs';

const TMP_ROOT = join(import.meta.dirname, '__test_workflow_scripts__');

afterEach(() => {
  rmSync(TMP_ROOT, { recursive: true, force: true });
});

describe('workflow helper scripts', () => {
  it('validates a complete plan with contiguous task files', () => {
    const specDir = join(TMP_ROOT, 'specs', 'feature');
    mkdirSync(join(specDir, 'tasks'), { recursive: true });
    writeFileSync(join(specDir, 'plan.md'), `# Feature Plan

## Task Overview

| Task | File |
| ---- | ---- |
| T1 | \`tasks/T1.md\` |
| T2 | \`tasks/T2.md\` |

## Dependencies

T1 -> T2
`);
    writeTask(specDir, 1, 'None');
    writeTask(specDir, 2, 'T1');

    const result = validatePlan({ specDir });
    expect(result.errors).toEqual([]);
    expect(result.taskFiles).toHaveLength(2);
  });

  it('reports missing task fields and placeholders', () => {
    const specDir = join(TMP_ROOT, 'specs', 'bad-feature');
    mkdirSync(join(specDir, 'tasks'), { recursive: true });
    writeFileSync(join(specDir, 'plan.md'), '## Task Overview\n| T1 | `tasks/T1.md` |\n');
    writeFileSync(join(specDir, 'tasks', 'T1.md'), '### Task 1\nTODO\n');

    const result = validatePlan({ specDir });
    expect(result.ok).toBe(false);
    expect(result.errors.some(error => error.includes('placeholder'))).toBe(true);
    expect(result.errors.some(error => error.includes('complexity'))).toBe(true);
  });

  it('checks verification artifacts before completion', () => {
    const specDir = join(TMP_ROOT, 'specs', 'verified-feature');
    mkdirSync(specDir, { recursive: true });
    writeFileSync(join(specDir, 'spec.md'), '# Spec\n');
    writeFileSync(join(specDir, 'plan.md'), '# Plan\n');
    writeFileSync(join(specDir, 'progress.md'), 'Step 5 complete at 14:30\n');
    writeFileSync(join(specDir, 'test-report.md'), 'Conclusion: PASS\n');

    const result = verifyArtifacts({ specDir });
    expect(result.errors).toEqual([]);
  });

  it('rejects incomplete verification evidence', () => {
    const specDir = join(TMP_ROOT, 'specs', 'incomplete-feature');
    mkdirSync(specDir, { recursive: true });
    writeFileSync(join(specDir, 'spec.md'), '# Spec\n');
    writeFileSync(join(specDir, 'plan.md'), '# Plan\n');
    writeFileSync(join(specDir, 'progress.md'), 'Step 5 started at HH:mm\n');

    const result = verifyArtifacts({ specDir });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('Missing required artifact: test-report.md');
    expect(result.errors).toContain('progress.md still contains literal HH:mm placeholder');
  });

  it('validates engineering index and memory structure', () => {
    mkdirSync(join(TMP_ROOT, '.loom', 'index'), { recursive: true });
    mkdirSync(join(TMP_ROOT, '.loom', 'memory'), { recursive: true });
    writeFileSync(join(TMP_ROOT, '.loom', 'index', 'engineering-index.md'), `# Engineering Index

## Routes
## Controllers
## Services
## Models
## Call Chains
`);
    writeFileSync(join(TMP_ROOT, '.loom', 'memory', 'MEMORY.md'), '# Memory\n\n## Gotchas\n');

    const result = validateIndex({ root: TMP_ROOT });
    expect(result.errors).toEqual([]);
  });

  it('reports missing index sections', () => {
    mkdirSync(join(TMP_ROOT, '.loom', 'index'), { recursive: true });
    mkdirSync(join(TMP_ROOT, '.loom', 'memory'), { recursive: true });
    writeFileSync(join(TMP_ROOT, '.loom', 'index', 'engineering-index.md'), '# Engineering Index\n');
    writeFileSync(join(TMP_ROOT, '.loom', 'memory', 'MEMORY.md'), '# Memory\n');

    const result = validateIndex({ root: TMP_ROOT });
    expect(result.ok).toBe(false);
    expect(result.errors.some(error => error.includes('routes'))).toBe(true);
  });
});

function writeTask(specDir, number, deps) {
  writeFileSync(join(specDir, 'tasks', `T${number}.md`), `### Task ${number}: Implement slice

- **Complexity**: simple
- **Dependencies**: ${deps}
- **Files**:
  - Modify: \`src/example.js\`
  - Test: \`tests/example.test.js\`

- [ ] Step 1: write failing test
- [ ] Step 2: implement code

Run test for this task.
`);
}
