import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

const program = new Command();

program
  .name('rss')
  .description('rss — Requirement-Driven Software Engineering CLI')
  .version(pkg.version);

program
  .command('init')
  .description('Install rss to your project')
  .requiredOption('--tool <target>', 'Target tool: claude-code | cursor | copilot | opencode')
  .option('--dry-run', 'Show files to be generated without writing')
  .option('--force', 'Overwrite existing files (backs up first)')
  .action(async (options) => {
    const { default: init } = await import('./commands/init.js');
    await init(options);
  });

program
  .command('update')
  .description('Update installed rss files')
  .option('--tool <target>', 'Target tool (auto-detect if omitted)')
  .option('--dry-run', 'Show diff without applying')
  .action(async (options) => {
    const { default: update } = await import('./commands/update.js');
    await update(options);
  });

program
  .command('doctor')
  .description('Diagnose rss installation')
  .option('--tool <target>', 'Target tool (auto-detect if omitted)')
  .action(async (options) => {
    const { default: doctor } = await import('./commands/doctor.js');
    await doctor(options);
  });

program
  .command('uninstall')
  .description('Uninstall rss from your project')
  .option('--tool <target>', 'Target tool (auto-detect if omitted)')
  .action(async (options) => {
    const { default: uninstall } = await import('./commands/uninstall.js');
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
