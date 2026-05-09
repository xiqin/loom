import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAdapter, listAdapters } from '../adapters/registry.js';
import { parseVersion, needsUpdate } from '../utils/version.js';
import { BACKUP_DIR } from '../utils/backup.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8'));

export default async function doctor(options) {
  const projectRoot = process.cwd();

  console.log(`\n  rss doctor — Diagnosis Report\n  Project: ${projectRoot}\n`);

  const tools = options.tool ? [options.tool] : listAdapters();
  let foundAny = false;

  for (const tool of tools) {
    const adapter = getAdapter(tool);
    const targetFiles = adapter.getTargetFiles(projectRoot);
    const exists = targetFiles.some(f => {
      try { return existsSync(f); } catch { return false; }
    });

    if (!exists) continue;
    foundAny = true;

    console.log(`  [${tool}]`);

    for (const file of targetFiles) {
      if (!existsSync(file)) {
        console.log(`    MISSING: ${file}`);
        continue;
      }

      try {
        const fileStat = statSync(file);
        if (fileStat.isDirectory()) {
          const count = countFiles(file);
          console.log(`    OK: ${file} (${count} files)`);
          continue;
        }
      } catch {}

      const content = readFileSync(file, 'utf-8');
      const version = parseVersion(content);

      if (!version) {
        console.log(`    WARN: ${file} — no rss version marker`);
      } else if (needsUpdate(version, pkg.version)) {
        console.log(`    OUTDATED: ${file} — v${version} (current: v${pkg.version})`);
      } else {
        console.log(`    OK: ${file} — v${version}`);
      }
    }

    // Check .gitignore
    const gitignorePath = join(projectRoot, '.gitignore');
    if (existsSync(gitignorePath)) {
      const gitignore = readFileSync(gitignorePath, 'utf-8');
      if (gitignore.includes('.rss-backup/')) {
        console.log(`    OK: .gitignore includes .rss-backup/`);
      } else {
        console.log(`    WARN: .gitignore missing .rss-backup/ entry`);
      }
    } else {
      console.log(`    WARN: .gitignore not found`);
    }

    // Check backup count
    const backupRoot = join(projectRoot, BACKUP_DIR);
    if (existsSync(backupRoot)) {
      try {
        const backups = readdirSync(backupRoot).length;
        console.log(`    INFO: ${backups} backup(s) in ${BACKUP_DIR}/`);
      } catch {}
    }

    console.log('');
  }

  if (!foundAny) {
    console.log('  No rss installation detected. Run "rss init --tool <target>" to install.');
  }
}

function countFiles(dir) {
  let count = 0;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) count++;
      if (entry.isDirectory()) count += countFiles(join(dir, entry.name));
    }
  } catch {}
  return count;
}
