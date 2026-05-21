import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

describe('template schema', () => {
  it('declares exactly the placeholders used by each template', () => {
    const schema = JSON.parse(readFileSync(join(ROOT, 'config', 'templates.schema.json'), 'utf8'));

    for (const template of schema.templates) {
      const content = readFileSync(join(ROOT, template.sourceFile), 'utf8');
      const used = [...new Set([...content.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)].map(match => match[1]))].sort();
      const declared = [...new Set([
        ...(template.requiredVariables || []),
        ...(template.optionalVariables || []),
      ])].sort();

      expect(declared, template.sourceFile).toEqual(used);
    }
  });

  it('keeps agent entry templates lightweight and fully rendered', () => {
    for (const templateName of ['agents.md']) {
      const content = readFileSync(join(ROOT, 'templates', templateName), 'utf8');
      expect(content).toContain('.loom/rules/constitution.md');
      expect(content).not.toMatch(/\{\{[A-Z0-9_]+\}\}/);
    }
  });
});
