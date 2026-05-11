import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');

export default async function install(options) {
  const { tool, version: ver, dryRun = false, force = false } = options;
  const pkg = JSON.parse(readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf-8'));
  const version = ver || pkg.version;

  const { getUserAdapter, USER_TOOL_IDS } = await import('../core/installer.js');

  if (!USER_TOOL_IDS.includes(tool)) {
    console.log(`  Unknown tool: "${tool}". Supported: ${USER_TOOL_IDS.join(', ')}`);
    return;
  }

  const adapter = await getUserAdapter(tool);

  console.log(`\n  loom install --tool ${tool} --version ${version} (user-level)\n`);

  if (dryRun) {
    console.log(`  [dry-run] Would install loom@${version} for ${tool}\n`);
    console.log(`    user dir:  ${adapter.getUserDir()}`);
    if (adapter.supportsPlugin()) {
      console.log('    plugin:    will register via tool plugin system');
    } else {
      console.log(`    skills:    ${adapter.getSkillsDir()}`);
    }
    const cmdDir = adapter.getCommandsDir();
    if (cmdDir) console.log(`    commands:  ${cmdDir}`);
    console.log('');
    return;
  }

  const log = adapter.install(PROJECT_ROOT, version);
  console.log(log.join('\n'));
  console.log(`\n  Done.\n`);
}
