import { mkdirSync, cpSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { injectVersion, parseVersion } from '../utils/version.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = join(__dirname, '..', '..');
const SKIP_EXTENSIONS = new Set(['.png', '.jpg', '.gif', '.ico', '.woff', '.woff2', '.ttf']);

export class BaseAdapter {
  get name() {
    throw new Error('must implement get name()');
  }

  get entryFilename() {
    throw new Error('must implement get entryFilename()');
  }

  _getAssetsDir() {
    return ASSETS_DIR;
  }

  readAsset(relativePath) {
    return readFileSync(join(ASSETS_DIR, relativePath), 'utf-8');
  }

  async generate(projectRoot, version, options = {}) {
    throw new Error('must implement generate()');
  }

  getTargetFiles(projectRoot) {
    throw new Error('must implement getTargetFiles()');
  }

  _transformContent(content) {
    return content;
  }

  _copyDirRecursive(src, dest, version) {
    mkdirSync(dest, { recursive: true });
    const entries = readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = join(src, entry.name);
      const destPath = join(dest, entry.name);

      if (entry.isDirectory()) {
        this._copyDirRecursive(srcPath, destPath, version);
      } else {
        const ext = entry.name.slice(entry.name.lastIndexOf('.'));
        if (SKIP_EXTENSIONS.has(ext)) {
          cpSync(srcPath, destPath);
        } else {
          const content = readFileSync(srcPath, 'utf-8');
          const transformed = this._transformContent(content);
          if (parseVersion(transformed) !== null) {
            writeFileSync(destPath, transformed);
          } else if (ext === '.json') {
            // JSON files: skip version injection (comments break JSON parsing)
            writeFileSync(destPath, transformed);
          } else {
            writeFileSync(destPath, injectVersion(transformed, version));
          }
        }
      }
    }
  }
}
