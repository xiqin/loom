import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const MANIFEST_DIR = '.loom';
const MANIFEST_FILE = 'install-manifest.json';

export function getManifestPath(projectRoot, tool) {
  if (tool) {
    return join(projectRoot, MANIFEST_DIR, `install-manifest-${tool}.json`);
  }
  return join(projectRoot, MANIFEST_DIR, MANIFEST_FILE);
}

export function readManifest(projectRoot, tool) {
  const p = getManifestPath(projectRoot, tool);
  if (!existsSync(p) && tool) {
    const oldPath = getManifestPath(projectRoot);
    if (existsSync(oldPath)) {
      try {
        const data = JSON.parse(readFileSync(oldPath, 'utf-8'));
        if (data.tool === tool) return data;
      } catch {}
    }
    return null;
  }
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
  const p = getManifestPath(projectRoot, data.tool);
  writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  if (data.tool) {
    const oldPath = getManifestPath(projectRoot);
    try {
      if (existsSync(oldPath)) {
        const oldData = JSON.parse(readFileSync(oldPath, 'utf-8'));
        if (oldData.tool === data.tool) {
          unlinkSync(oldPath);
        }
      }
    } catch {}
  }
}

export function createManifest({ version, tool, filesCreated, filesUpdated, backups, fileChecksums }) {
  return {
    version,
    tool,
    filesCreated: filesCreated ?? [],
    filesUpdated: filesUpdated ?? [],
    backups: backups ?? [],
    fileChecksums: fileChecksums ?? {},
    installedAt: new Date().toISOString(),
  };
}
