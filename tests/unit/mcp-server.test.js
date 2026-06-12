import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';

function frame(json) {
  return `Content-Length: ${Buffer.byteLength(json, 'utf-8')}\r\n\r\n${json}`;
}

function parseFrames(output) {
  const frames = [];
  let rest = output;
  while (rest.length > 0) {
    const headerEnd = rest.indexOf('\r\n\r\n');
    if (headerEnd === -1) break;
    const header = rest.slice(0, headerEnd);
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) break;
    const start = headerEnd + 4;
    const end = start + Number(match[1]);
    frames.push(JSON.parse(rest.slice(start, end)));
    rest = rest.slice(end);
  }
  return frames;
}

async function runServer(input) {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['src/mcp/server.js'], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, LOOM_LAZY_TOOLS: '0' },
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`server timed out\nstdout=${stdout}\nstderr=${stderr}`));
    }, 2000);
    child.stdout.setEncoding('utf-8');
    child.stderr.setEncoding('utf-8');
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('close', () => {
      clearTimeout(timer);
      resolve({ stdout, stderr });
    });
    child.stdin.end(input);
  });
}

describe('MCP stdio transport', () => {
  it('handles newline-delimited JSON-RPC', async () => {
    const ping = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' });
    const { stdout } = await runServer(ping + '\n');

    expect(JSON.parse(stdout.trim())).toEqual({ jsonrpc: '2.0', id: 1, result: {} });
  });

  it('handles Content-Length framed JSON-RPC messages', async () => {
    const ping = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' });
    const initialize = JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'initialize', params: {} }, null, 2);
    const { stdout } = await runServer(frame(ping) + frame(initialize));
    const responses = parseFrames(stdout);

    expect(responses).toHaveLength(2);
    expect(responses[0]).toEqual({ jsonrpc: '2.0', id: 1, result: {} });
    expect(responses[1].id).toBe(2);
    expect(responses[1].result.serverInfo.name).toBe('loom-mcp-server');
  });
});
