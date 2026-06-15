import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SCRIPT = readFileSync(join(process.cwd(), 'scripts', 'generate-incremental.mjs'), 'utf-8');

describe('generate-incremental configuration', () => {
  it('tracks the shared generate-check helper as an input', () => {
    expect(SCRIPT).toContain('scripts/lib/generate-check.mjs');
  });

  it('runs progress rules generation through the incremental wrapper', () => {
    expect(SCRIPT).toContain("name: 'generate-progress-rules'");
    expect(SCRIPT).toContain('node scripts/generate-progress-rules.mjs');
    expect(SCRIPT).toContain('config/pipeline.schema.json');
  });
});
