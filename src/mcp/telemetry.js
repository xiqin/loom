/**
 * telemetry.js — 轻量会话级遥测
 *
 * 记录每个 MCP 工具调用的次数和累计耗时，会话结束时输出摘要到 stderr。
 * 不写入文件、不发送外部请求、不记录参数内容，仅统计级别信息。
 *
 * 启用方式：环境变量 LOOM_TELEMETRY=1（默认关闭）
 */

const ENABLED = process.env.LOOM_TELEMETRY === '1';

/** @type {Map<string, { count: number, totalMs: number, lastCall: string }>} */
const _stats = new Map();

/** 会话开始时间 */
const _sessionStart = new Date();

/**
 * 记录一次工具调用
 * @param {string} toolName
 * @param {number} durationMs
 */
export function recordCall(toolName, durationMs) {
  if (!ENABLED) return;
  const entry = _stats.get(toolName) || { count: 0, totalMs: 0, lastCall: '' };
  entry.count += 1;
  entry.totalMs += durationMs;
  entry.lastCall = new Date().toISOString();
  _stats.set(toolName, entry);
}

/**
 * 输出会话摘要到 stderr（不污染 stdout JSON 协议）
 */
export function printSummary() {
  if (!ENABLED || _stats.size === 0) return;

  const totalCalls = [..._stats.values()].reduce((s, e) => s + e.count, 0);
  const totalMs = [..._stats.values()].reduce((s, e) => s + e.totalMs, 0);
  const sessionDuration = Date.now() - _sessionStart.getTime();

  const lines = [
    `[loom telemetry] Session duration: ${(sessionDuration / 1000).toFixed(1)}s`,
    `[loom telemetry] Total tool calls: ${totalCalls}, Total tool time: ${(totalMs / 1000).toFixed(1)}s`,
    ...[..._stats.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .map(([name, e]) => `  ${name}: ${e.count} calls, ${(e.totalMs / 1000).toFixed(2)}s total`),
  ];

  process.stderr.write(lines.join('\n') + '\n');
}

/**
 * 获取当前统计快照（用于 MCP 工具查询）
 */
export function getSnapshot() {
  const tools = {};
  for (const [name, e] of _stats.entries()) {
    tools[name] = {
      calls: e.count,
      total_ms: Math.round(e.totalMs),
      last_call: e.lastCall
    };
  }

  return {
    enabled: ENABLED,
    session_start: _sessionStart.toISOString(),
    tools,
  };
}
