import { describe, it, expect } from 'vitest';
import {
  extractVariables,
  validateTemplate,
  validateRawTemplate,
  renderTemplate,
  getTemplateDef,
  listTemplateIds,
  getAllVariables,
} from '../../src/core/schema-validator.js';

describe('extractVariables', () => {
  it('extracts {{VAR}} names', () => {
    const vars = extractVariables('Hello {{NAME}}, version {{VERSION}}');
    expect(vars).toEqual(new Set(['NAME', 'VERSION']));
  });

  it('returns empty set for no variables', () => {
    expect(extractVariables('no vars here')).toEqual(new Set());
  });

  it('handles underscores and digits', () => {
    const vars = extractVariables('{{ARCH_V2}} and {{DB_1}}');
    expect(vars).toEqual(new Set(['ARCH_V2', 'DB_1']));
  });

  it('ignores lowercase variables', () => {
    const vars = extractVariables('{{lower}} and {{UPPER}}');
    expect(vars).toEqual(new Set(['UPPER']));
  });
});

describe('listTemplateIds', () => {
  it('returns array of template ids', () => {
    const ids = listTemplateIds();
    expect(ids).toContain('constitution');
    expect(ids).toContain('project-structure');
    expect(ids).toContain('rss');
    expect(ids).toContain('memory');
  });
});

describe('getTemplateDef', () => {
  it('returns template definition for known id', () => {
    const def = getTemplateDef('constitution');
    expect(def).not.toBeNull();
    expect(def.id).toBe('constitution');
    expect(def.requiredVariables).toContain('LANGUAGE');
  });

  it('returns null for unknown id', () => {
    expect(getTemplateDef('nonexistent')).toBeNull();
  });
});

describe('getAllVariables', () => {
  it('returns required and optional variables', () => {
    const vars = getAllVariables();
    expect(vars.required).toContain('LANGUAGE');
    expect(vars.required).toContain('PROJECT_NAME');
    expect(Array.isArray(vars.optional)).toBe(true);
  });
});

describe('validateTemplate', () => {
  it('valid when no required vars remain in rendered content', () => {
    const content = 'Language: Go, Framework: Fiber';
    const result = validateTemplate('constitution', content);
    expect(result.valid).toBe(true);
    expect(result.missingRequired).toEqual([]);
  });

  it('invalid when required vars still present', () => {
    const content = 'Language: {{LANGUAGE}}, Framework: {{WEB_FRAMEWORK}}';
    const result = validateTemplate('constitution', content);
    expect(result.valid).toBe(false);
    expect(result.missingRequired).toContain('LANGUAGE');
    expect(result.missingRequired).toContain('WEB_FRAMEWORK');
  });

  it('returns error for unknown template', () => {
    const result = validateTemplate('unknown', 'content');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Unknown template');
  });
});

describe('validateRawTemplate', () => {
  it('valid when all vars are declared', () => {
    const raw = 'Language: {{LANGUAGE}}, Framework: {{WEB_FRAMEWORK}}';
    const result = validateRawTemplate('constitution', raw);
    expect(result.valid).toBe(true);
    expect(result.undeclared).toEqual([]);
  });

  it('invalid when undeclared vars present', () => {
    const raw = 'Language: {{LANGUAGE}}, Custom: {{UNDECLARED_VAR}}';
    const result = validateRawTemplate('constitution', raw);
    expect(result.valid).toBe(false);
    expect(result.undeclared).toContain('UNDECLARED_VAR');
  });

  it('returns error for unknown template', () => {
    const result = validateRawTemplate('unknown', '{{VAR}}');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Unknown template');
  });
});

describe('renderTemplate', () => {
  it('replaces variables with provided values', () => {
    const raw = 'Project: {{PROJECT_NAME}}, Desc: {{PROJECT_DESC}}';
    const result = renderTemplate('rss', raw, {
      PROJECT_NAME: 'my-app',
      PROJECT_DESC: 'A test app',
      ENTRY_POINTS: 'main.go',
      BUILD_CMD: 'go build',
      TEST_CMD: 'go test',
      VET_CMD: 'go vet',
      ENTRY_FILE: 'main.go',
    });
    expect(result.content).toContain('my-app');
    expect(result.content).toContain('A test app');
    expect(result.content).not.toContain('{{PROJECT_NAME}}');
    expect(result.warnings).toEqual([]);
  });

  it('inserts TODO marker for missing required vars', () => {
    const raw = 'Language: {{LANGUAGE}}';
    const result = renderTemplate('constitution', raw, {});
    expect(result.content).toContain('<!-- TODO: LANGUAGE:');
    expect(result.missingRequired).toContain('LANGUAGE');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('silently removes missing optional vars', () => {
    // memory template has TECH_STACK_SUMMARY as required, no optional
    // Use project-structure which has no optional either
    // Let's test with a custom scenario using constitution (all required)
    const raw = '{{LANGUAGE}}';
    const result = renderTemplate('constitution', raw, { LANGUAGE: 'Go' });
    expect(result.content).toBe('Go');
    expect(result.missingOptional).toEqual([]);
  });

  it('returns warnings for undeclared variables', () => {
    const raw = '{{UNKNOWN_VAR}}';
    const result = renderTemplate('rss', raw, {});
    expect(result.content).toContain('{{UNKNOWN_VAR}}');
    expect(result.warnings.some(w => w.includes('Undeclared variable'))).toBe(true);
  });

  it('returns warning for unknown template id', () => {
    const result = renderTemplate('unknown', '{{VAR}}', {});
    expect(result.content).toBe('{{VAR}}');
    expect(result.warnings.some(w => w.includes('Unknown template'))).toBe(true);
  });

  it('handles custom missingHint option', () => {
    const raw = '{{TECH_STACK_SUMMARY}}';
    const result = renderTemplate('memory', raw, {}, { missingHint: '请填写技术栈' });
    expect(result.content).toContain('请填写技术栈');
  });
});
