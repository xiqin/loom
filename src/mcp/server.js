/**
 * server.js — loom MCP Server（stdio transport）
 *
 * 实现 MCP 协议（JSON-RPC over stdin/stdout），暴露 loom 工具集。
 * 无第三方 MCP SDK 依赖，直接实现协议子集（足以被 Claude Code / Cursor 调用）。
 *
 * 启动方式：
 *   node src/mcp/server.js              — 直接启动
 *   loom mcp-serve                      — 通过 CLI 启动
 *   在 MCP 配置中: "command": "loom", "args": ["mcp-serve"]
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { TOOL_DEFINITIONS, executeToolCall } from './tools.js';
import { SessionStore } from './session-store.js';
import { recordCall, printSummary } from './telemetry.js';

const SERVER_NAME = 'loom-mcp-server';
// 版本从 package.json 单源读取，避免与发布版本不同步
const SERVER_VERSION = (() => {
  try {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
    return JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8')).version || '0.0.0';
  } catch { return '0.0.0'; }
})();
const PROTOCOL_VERSION = '2025-06-18';

const sessionStore = new SessionStore();
// 每个 server 进程对应一个 stdio 连接，握手时生成唯一 sessionId
let sessionId = randomUUID();
let currentResponseFramed = false;

function lazyToolsEnabled() {
  return process.env.LOOM_LAZY_TOOLS !== '0';
}

function toMcpTool({ name, description, inputSchema }) {
  return { name, description, inputSchema };
}

export function listVisibleTools(store, id, { lazyEnabled = lazyToolsEnabled() } = {}) {
  if (!lazyEnabled) return TOOL_DEFINITIONS.map(toMcpTool);
  const loadedGroups = store.getLoadedGroups(id);
  return TOOL_DEFINITIONS
    .filter(t => loadedGroups.has(t.group))
    .map(toMcpTool);
}

function notifyToolsListChanged() {
  writeMessage({
    jsonrpc: '2.0',
    method: 'notifications/tools/list_changed'
  }, { framed: currentResponseFramed });
}

// ── JSON-RPC 处理 ──────────────────────────────────────────────────────────

function makeResponse(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function makeError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

async function handleRequest(msg) {
  const { id, method, params } = msg;

  switch (method) {

    case 'initialize':
      sessionId = randomUUID(); // 新握手 → 新会话，清掉上一连接的 spec 绑定残留
      return makeResponse(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: lazyToolsEnabled() } },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION }
      });

    case 'notifications/initialized':
      return null; // 无需响应

    case 'tools/list': {
      // 默认按 session loadedGroups 过滤工具列表（懒加载），减少上下文占用。
      // 设置 LOOM_LAZY_TOOLS=0 可恢复全量注册（向后兼容）。
      const tools = listVisibleTools(sessionStore, sessionId);
      return makeResponse(id, { tools });
    }

    case 'tools/call': {
      const toolName = params?.name;
      const args = params?.arguments || {};

      if (!toolName) return makeError(id, -32602, 'Missing tool name');

      const tool = TOOL_DEFINITIONS.find(t => t.name === toolName);
      if (!tool) return makeError(id, -32602, `Unknown tool: ${toolName}`);

      const startTime = Date.now();
      try {
        const result = await executeToolCall(toolName, args, sessionStore, sessionId);
        recordCall(toolName, Date.now() - startTime);
        if (toolName === 'loom_load_tool_group' && result?.ok && lazyToolsEnabled()) {
          notifyToolsListChanged();
        }
        return makeResponse(id, {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        });
      } catch (error) {
        recordCall(toolName, Date.now() - startTime);
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

function writeMessage(msg, { framed = false } = {}) {
  const json = JSON.stringify(msg);
  if (framed) {
    process.stdout.write(`Content-Length: ${Buffer.byteLength(json, 'utf-8')}\r\n\r\n${json}`);
  } else {
    process.stdout.write(json + '\n');
  }
}

async function processRawMessage(raw, { framed = false } = {}) {
  try {
    const msg = JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf-8') : raw);
    currentResponseFramed = framed;
    const response = await handleRequest(msg);
    if (response) writeMessage(response, { framed });
  } catch (err) {
    writeMessage(makeError(null, -32700, `Parse error: ${err.message}`), { framed });
  } finally {
    currentResponseFramed = false;
  }
}

export function startServer() {
  let buffer = Buffer.alloc(0);
  let processing = Promise.resolve();

  async function drainBuffer() {
    while (buffer.length > 0) {
      const asText = buffer.toString('utf-8', 0, Math.min(buffer.length, 64));
      if (/^Content-Length:/i.test(asText)) {
        const crlfEnd = buffer.indexOf(Buffer.from('\r\n\r\n'));
        const lfEnd = buffer.indexOf(Buffer.from('\n\n'));
        const headerEnd = crlfEnd !== -1 ? crlfEnd : lfEnd;
        if (headerEnd === -1) return;

        const separatorLength = crlfEnd !== -1 ? 4 : 2;
        const header = buffer.toString('utf-8', 0, headerEnd);
        const match = header.match(/Content-Length:\s*(\d+)/i);
        if (!match) {
          writeMessage(makeError(null, -32700, 'Parse error: Missing Content-Length'), { framed: true });
          buffer = buffer.subarray(headerEnd + separatorLength);
          continue;
        }

        const length = Number(match[1]);
        const bodyStart = headerEnd + separatorLength;
        const bodyEnd = bodyStart + length;
        if (buffer.length < bodyEnd) return;

        const body = buffer.subarray(bodyStart, bodyEnd);
        buffer = buffer.subarray(bodyEnd);
        await processRawMessage(body, { framed: true });
        continue;
      }

      const newlineIdx = buffer.indexOf(0x0a);
      if (newlineIdx === -1) return;
      const line = buffer.toString('utf-8', 0, newlineIdx).trim();
      buffer = buffer.subarray(newlineIdx + 1);
      if (!line) continue;
      await processRawMessage(line, { framed: false });
    }
  }

  process.stdin.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    processing = processing.then(drainBuffer);
  });

  process.stdin.on('end', () => {
    processing = processing.then(async () => {
      const rest = buffer.toString('utf-8').trim();
      buffer = Buffer.alloc(0);
      if (rest && !/^Content-Length:/i.test(rest)) {
        await processRawMessage(rest, { framed: false });
      }
    });
  });

  process.stdin.on('close', () => {
    processing.finally(() => {
      printSummary();
      process.exit(0);
    });
  });

  process.on('SIGTERM', () => {
    processing.finally(() => {
      printSummary();
      process.exit(0);
    });
  });

  // stderr 用于 debug 日志（不污染 stdout JSON 协议）
  process.stderr.write(`[${SERVER_NAME}] Started on stdio\n`);
}

// 直接运行时启动
const isMain = process.argv[1]?.endsWith('server.js') || process.argv[1]?.endsWith('server');
if (isMain) {
  startServer();
}
