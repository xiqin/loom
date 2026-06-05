/**
 * loom run — 流水线执行引擎 CLI 入口
 *
 * 用法：
 *   loom run --spec-dir specs/2026-05-27+user-auth            初始化并启动
 *   loom run --spec-dir <dir> --advance                       推进到下一阶段
 *   loom run --spec-dir <dir> --approve                       通过 gate 审批
 *   loom run --spec-dir <dir> --fail "reason"                 标记失败
 *   loom run --spec-dir <dir> --recover <stage>               从失败恢复
 *   loom run --spec-dir <dir> --task T1 --task-status done    更新 task 状态
 *   loom run --spec-dir <dir> --context                       输出阶段上下文（给 MCP / AI）
 */

import { resolve } from 'node:path';
import { PipelineEngine } from '../core/pipeline-engine.js';
import { SpecLock } from '../core/lock.js';
import { isReportPassing, parseVerdict } from '../core/artifact-checker.js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export default async function run(options) {
  const cwd = options.cwd || process.cwd();
  const specDir = options.specDir;

  if (!specDir) {
    console.error('\n  loom run: --spec-dir is required\n');
    process.exitCode = 1;
    return;
  }

  const absSpecDir = resolve(cwd, specDir);
  const engine = new PipelineEngine(cwd, absSpecDir);
  const lock = new SpecLock(absSpecDir);

  // ── --verdict: 读 qa-report.md → PASS/PARTIAL/FAIL + exit code ─────────
  if (options.verdict) {
    const reportFile = options.verdictFile || 'qa-report.md';
    const reportPath = join(absSpecDir, reportFile);
    if (!existsSync(reportPath)) {
      console.error(`\n  ✗ ${reportFile} not found in ${absSpecDir}\n`);
      process.exitCode = 1;
      return;
    }
    const content = readFileSync(reportPath, 'utf-8');
    const verdict = parseVerdict(content) || 'FAIL';
    console.log(verdict);
    if (verdict === 'PASS')    { process.exitCode = 0; }
    else if (verdict === 'PARTIAL') { process.exitCode = 2; }
    else                       { process.exitCode = 1; }
    return;
  }

  // ── --context: 只读，不需要锁 ────────────────────────────────────────────
  if (options.context) {
    const ctx = engine.getStageContext();
    if (!ctx) {
      console.log('\n  Pipeline not initialized. Run: loom run --spec-dir <dir>\n');
      return;
    }
    console.log(JSON.stringify(ctx, null, 2));
    return;
  }

  // ── --task + --task-status: 更新 task 状态（subagent 调用）──────────────
  if (options.task && options.taskStatus) {
    const patch = { status: options.taskStatus };
    if (options.blocker) patch.blocker = options.blocker;
    if (options.taskStatus === 'reviewing' || options.taskStatus === 'failed') {
      const current = engine.store.readTask(options.task);
      if (current && options.taskStatus === 'failed') {
        patch.retry_count = (current.retry_count || 0) + 1;
      }
    }
    const state = engine.store.updateTask(options.task, patch);
    console.log(`  ✓ ${options.task} → ${state.status}`);
    return;
  }

  // ── 以下操作需要锁 ───────────────────────────────────────────────────────
  // （--advance / --approve / --fail / --recover / 默认初始化）

  // 检查锁（不获取，只检查——避免 status 查询时意外加锁）
  if (options.advance || options.approve || options.fail || options.recover || (!options.context && !options.task)) {
    // advance/approve 等操作本身是幂等的短操作，不需要长锁
    // 但检查是否有 loom run 长进程在运行
    if (lock.isLocked() && !options.force) {
      const content = lock.acquire(); // 这里 acquire 会发现已锁
      if (!content.acquired) {
        console.error(`\n  ✗ spec is locked by PID ${content.pid} (started: ${content.startedAt || 'unknown'})`);
        console.error(`  Use --force to override\n`);
        process.exitCode = 1;
        return;
      }
    }
  }

  // ── --advance ────────────────────────────────────────────────────────────
  if (options.advance) {
    const result = engine.advance();
    if (result.ok) {
      console.log(`\n  ✓ Pipeline advanced: ${result.from} → ${result.to}\n`);
    } else {
      console.error(`\n  ✗ Cannot advance: ${result.error}\n`);
      process.exitCode = 1;
    }
    return;
  }

  // ── --approve ────────────────────────────────────────────────────────────
  if (options.approve) {
    const result = engine.approve();
    if (result.ok) {
      console.log(`\n  ✓ Gate approved: ${result.from} → ${result.to}\n`);
    } else {
      console.error(`\n  ✗ Cannot approve: ${result.error}\n`);
      process.exitCode = 1;
    }
    return;
  }

  // ── --fail ───────────────────────────────────────────────────────────────
  if (options.fail) {
    const result = engine.markFailed(options.fail);
    if (result.ok) {
      console.log(`\n  ✓ Marked failed at stage "${result.stage}": ${result.reason}\n`);
    } else {
      console.error(`\n  ✗ ${result.error}\n`);
      process.exitCode = 1;
    }
    return;
  }

  // ── --recover ────────────────────────────────────────────────────────────
  if (options.recover) {
    const result = engine.recover(options.recover);
    if (result.ok) {
      console.log(`\n  ✓ Recovered: ${result.from} → ${result.to}\n`);
    } else {
      console.error(`\n  ✗ ${result.error}\n`);
      process.exitCode = 1;
    }
    return;
  }

  // ── 默认：初始化并显示状态 ───────────────────────────────────────────────
  const existing = engine.store.read();
  if (existing) {
    const ctx = engine.getStageContext();
    console.log(`\n  loom run — spec: ${specDir}\n`);
    console.log(`  Stage:    ${ctx.current_stage}${ctx.is_gate ? ' (⏸ gate — needs --approve)' : ''}`);
    console.log(`  Type:     ${ctx.pipeline_type}`);
    console.log(`  Skill:    ${ctx.current_skill || '(none)'}`);
    console.log(`  Next:     ${ctx.next_stage || '(end)'}`);
    if (ctx.tasks_summary.total > 0) {
      const s = ctx.tasks_summary;
      console.log(`  Tasks:    ${s.total} total (${s.done} done, ${s.executing} running, ${s.failed} failed, ${s.blocked} blocked)`);
    }
    console.log(`  Started:  ${ctx.started_at?.slice(0, 16).replace('T', ' ')}`);
    console.log('');
    return;
  }

  // 首次初始化
  const type = options.type || null;
  const result = engine.initialize(type);
  console.log(`\n  ✓ Pipeline initialized: ${result.state.pipeline_type}`);
  console.log(`  Stage: ${result.state.current_stage}`);
  console.log(`  State: ${absSpecDir}/pipeline.state.json\n`);
}
