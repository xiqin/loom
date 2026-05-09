import { ClaudeCodeAdapter } from './claude-code.js';
import { CursorAdapter } from './cursor.js';
import { CopilotAdapter } from './copilot.js';
import { OpenCodeAdapter } from './opencode.js';

const adapters = {
  'claude-code': new ClaudeCodeAdapter(),
  'cursor': new CursorAdapter(),
  'copilot': new CopilotAdapter(),
  'opencode': new OpenCodeAdapter(),
};

export function getAdapter(tool) {
  const adapter = adapters[tool];
  if (!adapter) {
    throw new Error(`Unknown tool: "${tool}". Supported: ${listAdapters().join(', ')}`);
  }
  return adapter;
}

export function listAdapters() {
  return Object.keys(adapters);
}
