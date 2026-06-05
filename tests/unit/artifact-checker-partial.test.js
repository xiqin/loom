import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseVerdict, isReportPassing } from '../../src/core/artifact-checker.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'loom-partial-')); }
const write = (dir, file, content) => writeFileSync(join(dir, file), content, 'utf-8');

describe('parseVerdict — PARTIAL 支持（#7）', () => {
  it('识别 PARTIAL', () => {
    expect(parseVerdict('verdict: PARTIAL')).toBe('PARTIAL');
  });

  it('识别中文 部分', () => {
    expect(parseVerdict('结论：部分')).toBe('PARTIAL');
  });

  it('PASS/FAIL 不受影响', () => {
    expect(parseVerdict('verdict: PASS')).toBe('PASS');
    expect(parseVerdict('verdict: FAIL')).toBe('FAIL');
  });

  it('PARTIAL 不等于 PASS', () => {
    expect(parseVerdict('verdict: PARTIAL')).not.toBe('PASS');
  });
});

describe('isReportPassing — 通用 verdict 检查（#2#3 合并）', () => {
  it('PASS → true', () => {
    const dir = tmp();
    write(dir, 'qa-report.md', 'verdict: PASS\n全部绿');
    expect(isReportPassing(dir, 'qa-report.md')).toBe(true);
  });

  it('FAIL → false', () => {
    const dir = tmp();
    write(dir, 'qa-report.md', 'verdict: FAIL\n有失败');
    expect(isReportPassing(dir, 'qa-report.md')).toBe(false);
  });

  it('PARTIAL → false（门禁只认 PASS）', () => {
    const dir = tmp();
    write(dir, 'qa-report.md', 'verdict: PARTIAL\n手动遗留');
    expect(isReportPassing(dir, 'qa-report.md')).toBe(false);
  });

  it('文件不存在 → false', () => {
    expect(isReportPassing(tmp(), 'qa-report.md')).toBe(false);
  });

  it('任意文件名都能检查（不限于 test-report/verify-report）', () => {
    const dir = tmp();
    write(dir, 'custom-verdict.md', 'verdict: PASS');
    expect(isReportPassing(dir, 'custom-verdict.md')).toBe(true);
  });

  it('无显式裁定走启发式：有 PASS 无 FAIL → true', () => {
    const dir = tmp();
    write(dir, 'qa-report.md', '所有检查 PASS，共 10 项通过');
    expect(isReportPassing(dir, 'qa-report.md')).toBe(true);
  });

  it('无显式裁定走启发式：有 FAIL → false', () => {
    const dir = tmp();
    write(dir, 'qa-report.md', '发现 FAIL，测试未通过');
    expect(isReportPassing(dir, 'qa-report.md')).toBe(false);
  });
});
