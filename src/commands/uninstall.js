import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');

export default async function uninstall(options) {
  const { tool, version: ver, dryRun = false } = options;
  const pkg = JSON.parse(readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf-8'));
  const version = ver || pkg.version;

  const { getUserAdapter, USER_TOOL_IDS } = await import('../core/installer.js');

  if (!USER_TOOL_IDS.includes(tool)) {
    console.log(`  Unknown tool: "${tool}". Supported: ${USER_TOOL_IDS.join(', ')}`);
    return;
  }

  const adapter = await getUserAdapter(tool);

  console.log(`\n  loom uninstall --tool ${tool} (user-level)\n`);

  if (dryRun) {
    console.log(`  [dry-run] Would uninstall loom for ${tool}\n`);
    console.log(`    user dir:  ${adapter.getUserDir()}`);
    if (adapter.supportsPlugin()) {
      console.log('    plugin:    will unregister from tool plugin system');
    }
    console.log(`    skills:    ${adapter.getSkillsDir()}`);
    const cmdDir = adapter.getCommandsDir();
    if (cmdDir) console.log(`    commands:  ${cmdDir}`);
    console.log('');
    return;
  }

  const log = adapter.uninstall(PROJECT_ROOT);
  console.log(log.join('\n'));
  console.log(`\n  Done.\n`);
}
