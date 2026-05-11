import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getUserAdapter, USER_TOOL_IDS } from '../core/installer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');
const pkg = JSON.parse(readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf-8'));

export default async function update(options) {
  const version = options.version || pkg.version;
  const tools = options.tool ? [options.tool] : USER_TOOL_IDS;

  console.log(`\n  loom update v${version}\n`);

  for (const tool of tools) {
    if (!USER_TOOL_IDS.includes(tool)) {
      console.log(`  Unknown tool: "${tool}". Supported: ${USER_TOOL_IDS.join(', ')}`);
      continue;
    }

    const adapter = await getUserAdapter(tool);
    console.log(`→ ${tool}`);

    if (options.dryRun) {
      console.log(`    [dry-run] Would reinstall loom@${version} for ${tool}`);
      console.log(`    user dir:  ${adapter.getUserDir()}`);
      const cmdDir = adapter.getCommandsDir();
      if (cmdDir) console.log(`    commands:  ${cmdDir}`);
      continue;
    }

    const log = adapter.install(PROJECT_ROOT, version);
    console.log(log.join('\n'));
  }

  console.log('');
}
