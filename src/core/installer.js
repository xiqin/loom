import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');

const ADAPTER_MAP = {
  'claude-code': { file: 'claude-code.js', cls: 'ClaudeCodeAdapter' },
  'opencode':    { file: 'opencode.js', cls: 'OpenCodeAdapter' },
  'cursor':      { file: 'cursor.js', cls: 'CursorAdapter' },
  'copilot':     { file: 'copilot.js', cls: 'CopilotAdapter' },
  'codex':       { file: 'codex.js', cls: 'CodexAdapter' },
};

export const USER_TOOL_IDS = Object.keys(ADAPTER_MAP);

export async function getUserAdapter(tool) {
  const meta = ADAPTER_MAP[tool];
  if (!meta) {
    throw new Error(`Unknown tool: "${tool}". Supported: ${USER_TOOL_IDS.join(', ')}`);
  }
  const mod = await import(`../adapters/${meta.file}`);
  return new mod[meta.cls]();
}
