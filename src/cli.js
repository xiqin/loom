import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOOL_IDS } from './generated/tooling.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

const program = new Command();

program
  .name('loom')
  .description('loom — AI 工程化框架 CLI')
  .version(pkg.version);

program
  .command('init')
  .description('Install loom: assets to .loom/, wrappers to tool-specific dir')
  .requiredOption('--tool <target>', `Target tool: ${TOOL_IDS.join(' | ')}`)
  .option('--version <ver>', 'Version to install (default: package.json version)')
  .option('--dry-run', 'Show files to be generated without writing')
  .option('--force', 'Overwrite existing files (backs up first)')
  .action(async (options) => {
    const { install } = await import('./core/installer.js');
    await install({ ...options, update: false });
  });

program
  .command('update')
  .description('Resync .loom/ assets and tool wrappers from latest version')
  .option('--tool <target>', 'Target tool (auto-detect if omitted)')
  .option('--version <ver>', 'Version to install (default: package.json version)')
  .option('--dry-run', 'Show diff without applying')
  .action(async (options) => {
    const { default: updateCommand } = await import('./commands/update.js');
    await updateCommand(options);
  });

program
  .command('doctor')
  .description('Diagnose loom installation')
  .option('--tool <target>', 'Target tool (auto-detect if omitted)')
  .action(async (options) => {
    const { default: doctor } = await import('./commands/doctor.js');
    await doctor(options);
  });

program
  .command('uninstall')
  .description('Remove manifest-tracked generated files')
  .requiredOption('--tool <target>', `Target tool: ${TOOL_IDS.join(' | ')}`)
  .option('--dry-run', 'Preview files to be deleted without removing')
  .option('--purge', 'Also remove backups and .gitignore entries')
  .action(async (options) => {
    const { uninstall } = await import('./core/uninstaller.js');
    await uninstall(options);
  });

program
  .command('list')
  .description('List available skills and commands')
  .option('--type <kind>', 'Filter: skills | commands | all', 'all')
  .action(async (options) => {
    const { default: list } = await import('./commands/list.js');
    await list(options);
  });

program.parse();
