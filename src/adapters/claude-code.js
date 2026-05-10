import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
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
      .replace(/\{\{SKILLS_SECTION\}\}/g, '## Skills 清单\n\n所有 skills 和 commands 定义在 `.loom/skills/` 和 `.loom/commands/` 目录中。\n通过 `.claude/skills/` 和 `.claude/commands/` 中的包装器发现。');
  }

  async generate(projectRoot, version, options = {}) {
    this._generateLoomDirs(projectRoot, version);
    this._generateWrappers(projectRoot, version);
  }

  generateWrappers(projectRoot, version) {
    this._generateWrappers(projectRoot, version);
  }

  _generateWrappers(projectRoot, version) {
    const claudeDir = join(projectRoot, '.claude');

    const loomSkills = join(projectRoot, '.loom', 'skills');
    if (existsSync(loomSkills)) {
      this._generateSkillWrappers(loomSkills, join(claudeDir, 'skills'));
    }

    const loomCommands = join(projectRoot, '.loom', 'commands');
    if (existsSync(loomCommands)) {
      this._generateCommandWrappers(loomCommands, join(claudeDir, 'commands'));
    }

    const entryContent = this._generateEntryMd();
    mkdirSync(claudeDir, { recursive: true });
    writeFileSync(join(claudeDir, 'CLAUDE.md'), injectVersion(entryContent, version));
  }
}
