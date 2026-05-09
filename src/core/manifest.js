import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MANIFEST_DIR = '.rss';
const MANIFEST_FILE = 'install-manifest.json';

export function getManifestPath(projectRoot) {
  return join(projectRoot, MANIFEST_DIR, MANIFEST_FILE);
}

export function readManifest(projectRoot) {
  const p = getManifestPath(projectRoot);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

export function writeManifest(projectRoot, data) {
  const dir = join(projectRoot, MANIFEST_DIR);
  mkdirSync(dir, { recursive: true });
  const p = getManifestPath(projectRoot);
  writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

export function createManifest({ version, tool, filesCreated, filesUpdated, backups, hooksInstalled, fileChecksums }) {
  return {
    version,
    tool,
    filesCreated: filesCreated ?? [],
    filesUpdated: filesUpdated ?? [],
    backups: backups ?? [],
    hooksInstalled: hooksInstalled ?? false,
    fileChecksums: fileChecksums ?? {},
    installedAt: new Date().toISOString(),
  };
}
