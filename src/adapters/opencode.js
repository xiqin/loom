import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
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
      .replace(/\{\{SKILLS_SECTION\}\}/g, '## Skills 和 Commands\n\n所有 skills 定义在 `.opencode/skills/`，所有 commands 定义在 `.opencode/commands/` 目录中（均为指向 `.loom/` 源文件的包装器）。');
  }

  async generate(projectRoot, version, options = {}) {
    this._generateLoomDirs(projectRoot, version);
    this._generateWrappers(projectRoot, version);
  }

  generateWrappers(projectRoot, version) {
    this._generateWrappers(projectRoot, version);
  }

  _generateWrappers(projectRoot, version) {
    const opencodeDir = join(projectRoot, '.opencode');

    const loomSkills = join(projectRoot, '.loom', 'skills');
    if (existsSync(loomSkills)) {
      this._generateSkillWrappers(loomSkills, join(opencodeDir, 'skills'));
    }

    const loomCommands = join(projectRoot, '.loom', 'commands');
    if (existsSync(loomCommands)) {
      this._generateCommandWrappers(loomCommands, join(opencodeDir, 'commands'));
    }

    const entryContent = this._generateEntryMd();
    mkdirSync(opencodeDir, { recursive: true });
    writeFileSync(join(projectRoot, 'AGENTS.md'), injectVersion(entryContent, version));
  }
}
