/**
 * loom mcp-serve — 启动 MCP Server
 */

import { startServer } from '../mcp/server.js';

export default async function mcpServe(options) {
  if (options.help) {
    console.error(`
  loom mcp-serve

  Start the loom MCP server over stdio. Configure in your AI tool:

  Claude Code (~/.claude.json):
    "mcpServers": {
      "loom": { "command": "loom", "args": ["mcp-serve"] }
    }

  Cursor (.cursor/mcp.json):
    { "mcpServers": { "loom": { "command": "loom", "args": ["mcp-serve"] } } }
`);
    return;
  }
  startServer();
}
