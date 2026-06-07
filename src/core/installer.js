import { ADAPTER_MAP, IMPLEMENTED_TOOL_IDS } from '../generated/tooling.js';

export const USER_TOOL_IDS = IMPLEMENTED_TOOL_IDS;

export async function getUserAdapter(tool) {
  const meta = ADAPTER_MAP[tool];
  if (!meta) {
    throw new Error(`Unknown tool: "${tool}". Supported: ${USER_TOOL_IDS.join(', ')}`);
  }
  const mod = await import(`../adapters/${meta.file}.js`);
  return new mod[meta.cls]();
}
