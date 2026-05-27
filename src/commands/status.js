/**
 * loom status — 项目级流水线全景视图
 *
 * 用法：
 *   loom status                            当前目录所有 specs 的状态
 *   loom status --spec-dir <dir>           单个 spec 详情
 *   loom status --all                      团队视图（同 loom status）
 *   loom status --json                     JSON 输出（给 MCP 用）
 */

import { resolve, basename, relative } from 'node:path';
import { PipelineStateStore, scanAllSpecs } from '../core/state-store.js';

const STAGE_ICONS = {
  brainstorming: '💡', planning: '📝', approved: '✅',
  'git-worktree': '🌿', executing: '⚙️', verification: '🔍',
  synced: '🏁', failed: '❌'
};

export default async function status(options) {
  const cwd = options.cwd || process.cwd();

  // ── 单个 spec 详情 ────────────────────────────────────────────────────────
  if (options.specDir) {
    const absDir = resolve(cwd, options.specDir);
    const store = new PipelineStateStore(absDir);
    const snap = store.snapshot();

    if (options.json) {
      console.log(JSON.stringify(snap, null, 2));
      return;
    }

    console.log(`\n  loom status — ${relative(cwd, absDir) || absDir}\n`);

    if (!snap.pipeline) {
      console.log('  Pipeline not initialized. Run: loom run --spec-dir <dir>\n');
      return;
    }

    const p = snap.pipeline;
    const icon = STAGE_ICONS[p.current_stage] || '?';
    console.log(`  ${icon} Stage: ${p.current_stage}`);
    console.log(`  Type:    ${p.pipeline_type}`);
    console.log(`  Started: ${p.started_at?.slice(0, 16).replace('T', ' ')}`);
    console.log(`  Updated: ${p.updated_at?.slice(0, 16).replace('T', ' ')}`);
    if (p.failure_reason) console.log(`  Failure: ${p.failure_reason}`);

    if (snap.tasks.length > 0) {
      console.log('\n  Tasks:');
      for (const t of snap.tasks) {
        const tIcon = { pending: '⏳', executing: '▶', reviewing: '🔍', done: '✅', failed: '❌', blocked: '🚫' }[t.status] || '?';
        let line = `    ${tIcon} ${t.task_id}: ${t.status}`;
        if (t.retry_count > 0) line += ` (retries: ${t.retry_count})`;
        if (t.blocker) line += ` — blocked: ${t.blocker}`;
        console.log(line);
      }
    }

    if (snap.handoffs.length > 0) {
      console.log('\n  Handoffs:');
      for (const h of snap.handoffs) {
        const ifaces = (h.exported_interfaces || []).map(i => i.name).join(', ');
        console.log(`    ${h.task_id}: ${h.status || 'done'} → exports: [${ifaces}]`);
      }
    }

    if (p.stage_history?.length > 0) {
      console.log('\n  History:');
      for (const h of p.stage_history) {
        const hIcon = h.status === 'passed' ? '✅' : '❌';
        console.log(`    ${hIcon} ${h.stage} → ${h.exited_at?.slice(0, 16).replace('T', ' ')}`);
      }
    }

    console.log('');
    return;
  }

  // ── 全景视图 ──────────────────────────────────────────────────────────────
  const allSpecs = scanAllSpecs(cwd);

  if (options.json) {
    console.log(JSON.stringify(allSpecs, null, 2));
    return;
  }

  console.log(`\n  loom status — ${cwd}\n`);

  if (allSpecs.length === 0) {
    console.log('  No active pipelines found.\n');
    return;
  }

  // 表头
  console.log('  ┌──────────────────────────────────────┬────────────────┬───────────────┬──────────────┐');
  console.log('  │ Spec                                 │ Stage          │ Tasks         │ Updated      │');
  console.log('  ├──────────────────────────────────────┼────────────────┼───────────────┼──────────────┤');

  for (const spec of allSpecs) {
    const p = spec.pipeline;
    const name = basename(spec.spec_dir).slice(0, 36).padEnd(36);
    const icon = STAGE_ICONS[p.current_stage] || ' ';
    const stage = `${icon} ${p.current_stage}`.padEnd(14);

    const tasks = spec.tasks;
    const done = tasks.filter(t => t.status === 'done').length;
    const total = tasks.length;
    const taskStr = total > 0 ? `${done}/${total} done`.padEnd(13) : '—'.padEnd(13);

    const updated = (p.updated_at?.slice(5, 16).replace('T', ' ') || '—').padEnd(12);

    console.log(`  │ ${name} │ ${stage} │ ${taskStr} │ ${updated} │`);
  }

  console.log('  └──────────────────────────────────────┴────────────────┴───────────────┴──────────────┘');
  console.log('');
}
