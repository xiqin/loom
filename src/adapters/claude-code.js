import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { BaseAdapter } from './base.js';
import { injectVersion } from '../utils/version.js';

export class ClaudeCodeAdapter extends BaseAdapter {
  get name() {
    return 'claude-code';
  }

  get entryFilename() {
    return '.claude/CLAUDE.md';
  }

  getTargetFiles(projectRoot) {
    return [
      join(projectRoot, '.claude', 'CLAUDE.md'),
      join(projectRoot, '.claude', 'skills'),
      join(projectRoot, '.claude', 'commands'),
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
      .replace(/\{\{TOOL_NAME\}\}/g, 'claude-code')
      .replace(/\{\{SUBTITLE\}\}/g, '\n\n> AI 工程化框架，基于 superpowers 增强。\n')
      .replace(/\{\{SKILLS_SECTION\}\}/g, '## Skills 清单\n\n所有 skills 和 commands 定义在 `.loom/skills/` 和 `.loom/commands/` 目录中。\n通过 `.claude/skills/` 和 `.claude/commands/` 中的包装器发现。');
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

    // Generate .claude/ wrappers
    this._generateWrappers(projectRoot, version);
  }

  generateWrappers(projectRoot, version) {
    this._generateWrappers(projectRoot, version);
  }

  _generateWrappers(projectRoot, version) {
    const claudeDir = join(projectRoot, '.claude');

    // --- Skills wrappers ---
    const loomSkills = join(projectRoot, '.loom', 'skills');
    if (existsSync(loomSkills)) {
      this._generateSkillWrappers(loomSkills, join(claudeDir, 'skills'));
    }

    // --- Commands wrappers ---
    const loomCommands = join(projectRoot, '.loom', 'commands');
    if (existsSync(loomCommands)) {
      this._generateCommandWrappers(loomCommands, join(claudeDir, 'commands'));
    }

    // --- Generate .claude/CLAUDE.md ---
    const entryContent = this._generateEntryMd();
    mkdirSync(claudeDir, { recursive: true });
    writeFileSync(join(claudeDir, 'CLAUDE.md'), injectVersion(entryContent, version));
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
