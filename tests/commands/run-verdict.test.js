import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function tmp() { return mkdtempSync(join(tmpdir(), 'loom-verdict-')); }
const write = (dir, file, content) => writeFileSync(join(dir, file), content, 'utf-8');

async function runVerdict(specDir, options = {}) {
  const exitCodes = [];
  const outputs = [];
  const errors = [];

  const origExit = process.exitCode;
  process.exitCode = undefined;

  const origLog = console.log;
  const origErr = console.error;
  console.log = (msg) => outputs.push(String(msg));
  console.error = (msg) => errors.push(String(msg));

  try {
    const { default: runCommand } = await import('../../src/commands/run.js?bust=' + Date.now());
    await runCommand({ specDir, verdict: true, ...options });
  } finally {
    console.log = origLog;
    console.error = origErr;
  }

  const exitCode = process.exitCode;
  process.exitCode = origExit;
  return { exitCode, output: outputs.join('\n'), error: errors.join('\n') };
}

describe('loom run --verdict', () => {
  let dir;
  beforeEach(() => { dir = tmp(); });

  it('qa-report.md 不存在时 exit 1', async () => {
    const { exitCode, error } = await runVerdict(dir);
    expect(exitCode).toBe(1);
    expect(error).toMatch(/not found/);
  });

  it('verdict: PASS → stdout PASS，exit 0', async () => {
    write(dir, 'qa-report.md', '# QA 报告\n\nverdict: PASS\n全部通过');
    const { exitCode, output } = await runVerdict(dir);
    expect(output.trim()).toBe('PASS');
    expect(exitCode).toBe(0);
  });

  it('verdict: FAIL → stdout FAIL，exit 1', async () => {
    write(dir, 'qa-report.md', '# QA 报告\n\nverdict: FAIL\n有失败用例');
    const { exitCode, output } = await runVerdict(dir);
    expect(output.trim()).toBe('FAIL');
    expect(exitCode).toBe(1);
  });

  it('verdict: PARTIAL → stdout PARTIAL，exit 2', async () => {
    write(dir, 'qa-report.md', '# QA 报告\n\nverdict: PARTIAL\n手动用例遗留');
    const { exitCode, output } = await runVerdict(dir);
    expect(output.trim()).toBe('PARTIAL');
    expect(exitCode).toBe(2);
  });

  it('无 verdict 字段回退 FAIL，exit 1', async () => {
    write(dir, 'qa-report.md', '# QA 报告\n内容未给出裁定');
    const { exitCode, output } = await runVerdict(dir);
    expect(output.trim()).toBe('FAIL');
    expect(exitCode).toBe(1);
  });

  it('--verdict-file 指定自定义报告文件', async () => {
    write(dir, 'custom-report.md', 'verdict: PASS');
    const { exitCode, output } = await runVerdict(dir, { verdictFile: 'custom-report.md' });
    expect(output.trim()).toBe('PASS');
    expect(exitCode).toBe(0);
  });
});

async function runCommandWithCapture(options = {}) {
  const outputs = [];
  const errors = [];
  const origExit = process.exitCode;
  process.exitCode = undefined;
  const origLog = console.log;
  const origErr = console.error;
  console.log = (msg) => outputs.push(String(msg));
  console.error = (msg) => errors.push(String(msg));
  try {
    const { default: runCommand } = await import('../../src/commands/run.js?bust=' + Date.now() + Math.random());
    await runCommand(options);
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
  const exitCode = process.exitCode;
  process.exitCode = origExit;
  return { exitCode, output: outputs.join('\n'), error: errors.join('\n') };
}

describe('loom run write locking', () => {
  it('keeps the spec lock after task update failure when another process holds it', async () => {
    const root = tmp();
    const specDir = join(root, 'specs', 'feature');
    mkdirSync(specDir, { recursive: true });
    writeFileSync(join(specDir, '.loom-run.lock'), `${process.pid}\n2026-01-01T00:00:00.000Z\nother-token`, 'utf-8');

    const result = await runCommandWithCapture({
      cwd: root,
      specDir: 'specs/feature',
      task: 'T1',
      taskStatus: 'done'
    });

    expect(result.exitCode).toBe(1);
    expect(result.error).toMatch(/spec is locked/);
    expect(existsSync(join(specDir, '.loom-run.lock'))).toBe(true);
  });
});
