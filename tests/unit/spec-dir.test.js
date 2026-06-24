import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolvePipelineDir } from '../../src/core/spec-dir.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'loom-spec-dir-')); }

describe('resolvePipelineDir', () => {
  it('allows specs/<name> directories', () => {
    const root = tmp();
    expect(resolvePipelineDir(root, 'specs/feature')).toBe(join(root, 'specs', 'feature'));
  });

  it('allows qa/<name> directories', () => {
    const root = tmp();
    expect(resolvePipelineDir(root, 'qa/auth-release')).toBe(join(root, 'qa', 'auth-release'));
  });

  it('rejects project root as spec_dir', () => {
    const root = tmp();
    expect(() => resolvePipelineDir(root, '.')).toThrow(/points at project root/);
  });

  it('rejects directories outside project root', () => {
    const root = tmp();
    expect(() => resolvePipelineDir(root, '../../outside')).toThrow(/escapes project root/);
  });

  it('rejects project-root child directories outside specs or qa', () => {
    const root = tmp();
    expect(() => resolvePipelineDir(root, 'tasks')).toThrow(/specs\/<name> or qa\/<name>/);
  });
});
