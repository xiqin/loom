/**
 * server.js — loom MCP Server（stdio transport）
 *
 * 实现 MCP 协议（JSON-RPC over stdin/stdout），暴露 8 个工具。
 * 无第三方 MCP SDK 依赖，直接实现协议子集（足以被 Claude Code / Cursor 调用）。
 *
 * 启动方式：
 *   node src/mcp/server.js              — 直接启动
 *   loom mcp-serve                      — 通过 CLI 启动
 *   在 MCP 配置中: "command": "loom", "args": ["mcp-serve"]
 */

import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { TOOL_DEFINITIONS, executeToolCall } from './tools.js';
import { SessionStore } from './session-store.js';

const SERVER_NAME = 'loom-mcp-server';
// 版本从 package.json 单源读取，避免与发布版本不同步
const SERVER_VERSION = (() => {
  try {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
    return JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8')).version || '0.0.0';
  } catch { return '0.0.0'; }
})();
const PROTOCOL_VERSION = '2025-03-26';

const sessionStore = new SessionStore();
// 每个 server 进程对应一个 stdio 连接，握手时生成唯一 sessionId
let sessionId = randomUUID();

// ── JSON-RPC 处理 ──────────────────────────────────────────────────────────

function makeResponse(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function makeError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function handleRequest(msg) {
  const { id, method, params } = msg;

  switch (method) {

    case 'initialize':
      sessionId = randomUUID(); // 新握手 → 新会话，清掉上一连接的 spec 绑定残留
      return makeResponse(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION }
      });

    case 'notifications/initialized':
      return null; // 无需响应

    case 'tools/list':
      return makeResponse(id, {
        tools: TOOL_DEFINITIONS
      });

    case 'tools/call': {
      const toolName = params?.name;
      const args = params?.arguments || {};

      if (!toolName) return makeError(id, -32602, 'Missing tool name');

      const tool = TOOL_DEFINITIONS.find(t => t.name === toolName);
      if (!tool) return makeError(id, -32602, `Unknown tool: ${toolName}`);

      try {
        const result = executeToolCall(toolName, args, sessionStore, sessionId);
        return makeResponse(id, {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        });
      } catch (error) {
        return makeResponse(id, {
          content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }],
          isError: true
        });
      }
    }

    case 'ping':
      return makeResponse(id, {});

    default:
      if (method?.startsWith('notifications/')) return null;
      return makeError(id, -32601, `Method not found: ${method}`);
  }
}

// ── stdio transport ─────────────────────────────────────────────────────────

export function startServer() {
  const rl = createInterface({ input: process.stdin, terminal: false });
  let buffer = '';

  process.stdin.setEncoding('utf-8');

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const msg = JSON.parse(trimmed);
      const response = handleRequest(msg);
      if (response) {
        const json = JSON.stringify(response);
        process.stdout.write(json + '\n');
      }
    } catch (err) {
      // 尝试解析为 Content-Length 分帧（某些客户端使用 LSP 风格分帧）
      if (trimmed.startsWith('Content-Length:')) {
        // 跳过 header
        return;
      }
      // 其他解析失败
      const errResp = makeError(null, -32700, `Parse error: ${err.message}`);
      process.stdout.write(JSON.stringify(errResp) + '\n');
    }
  });

  rl.on('close', () => process.exit(0));

  // stderr 用于 debug 日志（不污染 stdout JSON 协议）
  process.stderr.write(`[${SERVER_NAME}] Started on stdio\n`);
}

// 直接运行时启动
const isMain = process.argv[1]?.endsWith('server.js') || process.argv[1]?.endsWith('server');
if (isMain) {
  startServer();
}
