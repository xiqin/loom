import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { BaseAdapter } from './base.js';
import { injectVersion } from '../utils/version.js';

export class OpenCodeAdapter extends BaseAdapter {
  get name() {
    return 'opencode';
  }

  get entryFilename() {
    return 'AGENTS.md';
  }

  getTargetFiles(projectRoot) {
    return [
      join(projectRoot, 'AGENTS.md'),
      join(projectRoot, '.opencode', 'skills'),
      join(projectRoot, '.opencode', 'commands'),
      join(projectRoot, '.loom', 'skills'),
      join(projectRoot, '.loom', 'commands'),
      join(projectRoot, '.loom', 'hooks'),
      join(projectRoot, '.loom', 'hooks', 'handlers'),
      join(projectRoot, '.loom', 'templates'),
      join(projectRoot, '.loom', 'core'),
    ];
  }

  _transformContent(content) {
    return content
      .replace(/\{\{ENTRY_FILE\}\}/g, this.entryFilename)
      .replace(/\{\{TOOL_NAME\}\}/g, 'opencode')
      .replace(/\{\{SUBTITLE\}\}/g, '\n')
      .replace(/\{\{SKILLS_SECTION\}\}/g, '## Skills 和 Commands\n\n所有 skills 定义在 `.opencode/skills/`，所有 commands 定义在 `.opencode/commands/` 目录中（均为指向 `.loom/` 源文件的包装器）。');
  }

  async generate(projectRoot, version, options = {}) {
    const assetsDir = this._getAssetsDir();

    // Copy directories to .loom/ (single source of truth)
    const dirs = ['skills', 'commands', 'hooks', 'templates', 'core'];
    for (const dir of dirs) {
      const src = join(assetsDir, dir);
      const dest = join(projectRoot, '.loom', dir);
      this._copyDirRecursive(src, dest, version);
    }

    // Copy schema to .loom/schema/
    const schemaPath = join(assetsDir, 'config', 'templates.schema.json');
    if (existsSync(schemaPath)) {
      const schemaDest = join(projectRoot, '.loom', 'schema', 'templates.schema.json');
      mkdirSync(join(projectRoot, '.loom', 'schema'), { recursive: true });
      const schemaContent = readFileSync(schemaPath, 'utf-8');
      writeFileSync(schemaDest, schemaContent);
    }

    // Generate .opencode/ wrappers
    this._generateWrappers(projectRoot, version);
  }

  generateWrappers(projectRoot, version) {
    this._generateWrappers(projectRoot, version);
  }

  _generateWrappers(projectRoot, version) {
    const opencodeDir = join(projectRoot, '.opencode');

    // --- Skill wrappers (from .loom/skills/) ---
    const loomSkills = join(projectRoot, '.loom', 'skills');
    if (existsSync(loomSkills)) {
      this._generateSkillWrappers(loomSkills, join(opencodeDir, 'skills'));
    }

    // --- Command wrappers ---
    const loomCommands = join(projectRoot, '.loom', 'commands');
    if (existsSync(loomCommands)) {
      this._generateCommandWrappers(loomCommands, join(opencodeDir, 'commands'));
    }

    // --- Generate AGENTS.md ---
    const entryContent = this._generateEntryMd();
    mkdirSync(opencodeDir, { recursive: true });
    writeFileSync(join(projectRoot, 'AGENTS.md'), injectVersion(entryContent, version));
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

      const wrapper = `---
name: ${name}
---

Full definition: @.loom/skills/${entry.name}/SKILL.md
`;
      writeFileSync(join(destDir, `${entry.name}.md`), wrapper);
    }
  }

  _extractYamlFrontMatter(content) {
    const result = {};
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return result;
    const lines = match[1].split('\n');
    for (const line of lines) {
      const kv = line.match(/^(\w+):\s*(.+)/);
      if (kv) {
        const val = kv[2].trim();
        if (val.startsWith('>')) {
          result[kv[1]] = val.replace(/^>\s*/, '').trim();
        } else {
          result[kv[1]] = val;
        }
      }
    }
    return result;
  }

  _generateEntryMd() {
    return this._transformContent(this.readAsset('templates/loom.md'));
  }
}
