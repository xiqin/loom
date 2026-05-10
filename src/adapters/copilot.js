import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BaseAdapter } from './base.js';
import { injectVersion } from '../utils/version.js';

export class CopilotAdapter extends BaseAdapter {
  get name() {
    return 'copilot';
  }

  get entryFilename() {
    return '.github/copilot-instructions.md';
  }

  getTargetFiles(projectRoot) {
    return [
      join(projectRoot, '.github', 'copilot-instructions.md'),
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
      .replace(/\{\{SKILLS_SECTION\}\}/g, '## Skills 清单\n\n所有 skills 和 commands 定义在 `.loom/skills/` 和 `.loom/commands/` 目录中。');
  }

  async generate(projectRoot, version, options = {}) {
    this._generateLoomDirs(projectRoot, version);

    const dir = join(projectRoot, '.github');
    mkdirSync(dir, { recursive: true });

    const entryContent = this._generateEntryMd();
    writeFileSync(join(dir, 'copilot-instructions.md'), injectVersion(entryContent, version));
  }
}
