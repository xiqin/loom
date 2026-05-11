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
  .version(pkg.version)
  .enablePositionalOptions();

program
  .command('install')
  .description('Install loom at user-level (global) for CLI tool')
  .requiredOption('--tool <target>', 'Target tool: claude-code | opencode | cursor | copilot | codex')
  .option('--version <ver>', 'Version to install (default: package.json version)')
  .option('--dry-run', 'Show what would be installed without writing')
  .action(async (options) => {
    const { default: installCommand } = await import('./commands/install.js');
    await installCommand(options);
  });

program
  .command('update')
  .description('Reinstall loom at user-level for CLI tool (update)')
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
  .description('Remove user-level installation for CLI tool')
  .requiredOption('--tool <target>', 'Target tool: claude-code | opencode | cursor | copilot | codex')
  .option('--dry-run', 'Show what would be removed without deleting')
  .action(async (options) => {
    const { default: uninstallCommand } = await import('./commands/uninstall.js');
    await uninstallCommand(options);
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
