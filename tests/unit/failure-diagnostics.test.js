import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FailureDiagnostics } from '../../src/core/failure-diagnostics.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'loom-diag-')); }

describe('FailureDiagnostics', () => {
  let dir;
  beforeEach(() => { dir = tmp(); });

  describe('diagnose', () => {
    it('detects test failure', () => {
      const diag = new FailureDiagnostics(dir);
      const result = diag.diagnose('test failed: expected 1 got 2');
      expect(result.categories.length).toBeGreaterThan(0);
      expect(result.categories[0].category).toBe('test_failure');
    });

    it('detects compilation error', () => {
      const diag = new FailureDiagnostics(dir);
      const result = diag.diagnose('compile error: TypeScript type mismatch');
      expect(result.categories[0].category).toBe('compilation_error');
    });

    it('detects git conflict', () => {
      const diag = new FailureDiagnostics(dir);
      const result = diag.diagnose('merge conflict in src/index.js');
      expect(result.categories[0].category).toBe('git_conflict');
    });

    it('falls back to unknown for unrecognized errors', () => {
      const diag = new FailureDiagnostics(dir);
      const result = diag.diagnose('something weird happened');
      expect(result.categories[0].category).toBe('unknown');
    });

    it('returns summary', () => {
      const diag = new FailureDiagnostics(dir);
      const result = diag.diagnose('compile error');
      expect(result.summary).toBeDefined();
    });
  });

  describe('suggestRecovery', () => {
    it('returns recovery steps for test failure', () => {
      const diag = new FailureDiagnostics(dir);
      const result = diag.suggestRecovery('test failed');
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.timeEstimate).toBeDefined();
      expect(result.riskLevel).toBeDefined();
      expect(result.category).toBe('test_failure');
    });
  });

  describe('verifyRecoverySafety', () => {
    it('blocks when prerequisites are missing', () => {
      const diag = new FailureDiagnostics(dir);
      const result = diag.verifyRecoverySafety('planning');
      expect(result.safe).toBe(false);
      expect(result.blockers).toContain('前置产物缺失: spec.md');
    });

    it('passes when prerequisites exist', () => {
      writeFileSync(join(dir, 'spec.md'), 'Valid spec content without placeholders', 'utf-8');
      const diag = new FailureDiagnostics(dir);
      const result = diag.verifyRecoverySafety('planning');
      expect(result.safe).toBe(true);
    });

    it('warns when output has placeholders', () => {
      writeFileSync(join(dir, 'spec.md'), 'TBD: need to fill this', 'utf-8');
      const diag = new FailureDiagnostics(dir);
      const result = diag.verifyRecoverySafety('brainstorming');
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});
