import { IMPLEMENTED_TOOL_IDS } from '../generated/tooling.js';
import { ClaudeCodeAdapter } from './claude-code.js';
import { CursorAdapter } from './cursor.js';
import { CopilotAdapter } from './copilot.js';
import { OpenCodeAdapter } from './opencode.js';

const adapterClasses = {
  'claude-code': ClaudeCodeAdapter,
  'cursor': CursorAdapter,
  'copilot': CopilotAdapter,
  'opencode': OpenCodeAdapter,
};

// Lazy-instantiate adapters
const adapterInstances = {};

export function getAdapter(tool) {
  if (!adapterInstances[tool]) {
    const Cls = adapterClasses[tool];
    if (!Cls) {
      throw new Error(`Unknown tool: "${tool}". Supported: ${listAdapters().join(', ')}`);
    }
    adapterInstances[tool] = new Cls();
  }
  return adapterInstances[tool];
}

export function getEntryFilename(tool) {
  return getAdapter(tool).entryFilename;
}

export function listAdapters() {
  return IMPLEMENTED_TOOL_IDS.filter(id => id in adapterClasses);
}
