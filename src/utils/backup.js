import { mkdirSync, cpSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';

export const BACKUP_DIR = '.loom-backup';
const MAX_BACKUPS = 5;

export function createBackup(projectRoot, filePaths) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupRoot = join(projectRoot, BACKUP_DIR);
  const backupPath = join(backupRoot, timestamp);

  mkdirSync(backupPath, { recursive: true });

  for (const filePath of filePaths) {
    const relPath = relative(projectRoot, filePath);
    const destPath = join(backupPath, relPath);
    mkdirSync(dirname(destPath), { recursive: true });
    const stat = statSync(filePath, { throwIfNoEntry: false });
    if (stat && stat.isDirectory()) {
      cpSync(filePath, destPath, { recursive: true });
    } else {
      cpSync(filePath, destPath);
    }
  }

  return backupPath;
}

export function cleanupBackups(projectRoot, keep = MAX_BACKUPS) {
  const backupRoot = join(projectRoot, BACKUP_DIR);

  let entries;
  try {
    entries = readdirSync(backupRoot)
      .filter(e => statSync(join(backupRoot, e)).isDirectory())
      .sort()
      .reverse();
  } catch (e) {
    console.warn(`Warning: could not read backup dir:`, e.message);
    return;
  }

  const toRemove = entries.slice(keep);
  for (const entry of toRemove) {
    rmSync(join(backupRoot, entry), { recursive: true, force: true });
  }
}
