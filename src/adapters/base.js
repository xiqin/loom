import { mkdirSync, cpSync, writeFileSync, readdirSync, readFileSync, existsSync } from 'node:fs';
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

  generateWrappers(projectRoot, version) {
  }

  getTargetFiles(projectRoot) {
    throw new Error('must implement getTargetFiles()');
  }

  _transformContent(content) {
    return content;
  }

  _generateLoomDirs(projectRoot, version) {
    const assetsDir = this._getAssetsDir();
    const dirs = ['skills', 'commands', 'hooks', 'templates', 'core'];
    for (const dir of dirs) {
      const src = join(assetsDir, dir);
      const dest = join(projectRoot, '.loom', dir);
      this._copyDirRecursive(src, dest, version);
    }

    const schemaPath = join(assetsDir, 'config', 'templates.schema.json');
    if (existsSync(schemaPath)) {
      const schemaDest = join(projectRoot, '.loom', 'schema', 'templates.schema.json');
      mkdirSync(join(projectRoot, '.loom', 'schema'), { recursive: true });
      const schemaContent = readFileSync(schemaPath, 'utf-8');
      writeFileSync(schemaDest, schemaContent);
    }
  }

  _generateEntryMd() {
    return this._transformContent(this.readAsset('templates/loom.md'));
  }

  _generateSkillWrappers(srcDir, destDir) {
    mkdirSync(destDir, { recursive: true });
    const entries = readdirSync(srcDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillMd = join(srcDir, entry.name, 'SKILL.md');
      if (!existsSync(skillMd)) continue;

      const content = readFileSync(skillMd, 'utf-8');
      const frontMatter = this._extractYamlFrontMatter(content);
      const name = frontMatter.name || entry.name;
      const description = frontMatter.description || '';

      const skillDir = join(destDir, entry.name);
      mkdirSync(skillDir, { recursive: true });
      const wrapper = `---
name: ${name}
description: ${description}
---

Full definition: @.loom/skills/${entry.name}/SKILL.md
`;
      writeFileSync(join(skillDir, 'SKILL.md'), wrapper);
    }
  }

  _generateCommandWrappers(srcDir, destDir) {
    mkdirSync(destDir, { recursive: true });
    const entries = readdirSync(srcDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const name = entry.name.replace(/\.md$/, '');
      const cmdName = name.replace(/^loom-/, '/');

      const wrapper = `# ${cmdName}

See @.loom/commands/${entry.name} for the full command definition.
`;
      writeFileSync(join(destDir, entry.name), wrapper);
    }
  }

  _extractYamlFrontMatter(content) {
    const result = {};
    const match = content.match(/---\n([\s\S]*?)\n---/);
    if (!match) return result;
    const lines = match[1].split('\n');
    let foldedKey = null;
    for (const line of lines) {
      if (foldedKey) {
        const cont = line.match(/^(\s+)(.*)/);
        if (cont && cont[1].length > 0) {
          result[foldedKey] += (result[foldedKey] ? ' ' : '') + cont[2].trim();
          continue;
        } else {
          foldedKey = null;
        }
      }
      const kv = line.match(/^(\w+):\s*(.*)/);
      if (kv) {
        const val = kv[2].trim();
        if (val === '>' || val === '>-') {
          foldedKey = kv[1];
          result[foldedKey] = '';
        } else {
          result[kv[1]] = val;
        }
      }
    }
    return result;
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
