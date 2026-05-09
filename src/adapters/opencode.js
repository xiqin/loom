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
      join(projectRoot, '.opencode', 'plugin.json'),
      join(projectRoot, '.opencode', 'skills'),
      join(projectRoot, '.opencode', 'commands'),
      join(projectRoot, '.rss', 'skills'),
      join(projectRoot, '.rss', 'commands'),
      join(projectRoot, '.rss', 'hooks'),
      join(projectRoot, '.rss', 'templates'),
      join(projectRoot, '.rss', 'core'),
    ];
  }

  _transformContent(content) {
    return content.replace(/\{\{ENTRY_FILE\}\}/g, this.entryFilename);
  }

  async generate(projectRoot, version, options = {}) {
    const assetsDir = this.getAssetsDir();

    // Copy directories: skills, commands, hooks, templates, core to .rss/
    const dirs = ['skills', 'commands', 'hooks', 'templates', 'core'];
    for (const dir of dirs) {
      const src = join(assetsDir, dir);
      const dest = join(projectRoot, '.rss', dir);
      this._copyDirRecursive(src, dest, version);
    }

    // Copy skills and commands to .opencode/ for OpenCode discovery
    for (const dir of ['skills', 'commands']) {
      const src = join(assetsDir, dir);
      const dest = join(projectRoot, '.opencode', dir);
      this._copyDirRecursive(src, dest, version);
    }

    // Copy plugin.json
    const pluginDir = join(projectRoot, '.opencode');
    mkdirSync(pluginDir, { recursive: true });
    const pluginContent = readFileSync(join(assetsDir, 'plugin-meta', 'opencode-plugin.json'), 'utf-8');
    writeFileSync(join(pluginDir, 'plugin.json'), pluginContent);

    // Generate AGENTS.md
    const entryContent = this._generateEntryMd();
    writeFileSync(join(projectRoot, this.entryFilename), injectVersion(entryContent, version));
  }

  _generateEntryMd() {
    const fn = this.entryFilename;
    return `# rss — Requirement-Driven Software Engineering

> AI 工程化框架，基于 superpowers 增强。

## 核心流水线

\`\`\`
brainstorming → writing-plans → git-worktree → subagent-dev → index-update
\`\`\`

## 项目规则

- **宪章**：\`.rss/memory/constitution.md\`（由 \`/rss-init-project\` 自动生成）
- **工程约束**：\`.rss/rules/project-structure.md\`（由 \`/rss-init-project\` 自动生成）

**所有开发活动必须遵守以上两份文件。**

## 快速开始

1. 安装 rss 框架（运行 \`rss init --tool opencode\`）
2. 首次使用请运行初始化命令扫描项目并生成配置
3. 开始需求头脑风暴，生成 \`specs/<date+feature>/spec.md\`
4. 拆解实现计划，生成 \`plan.md\`
5. 派发 subagent 执行编码
6. 编码完成后自动触发 index-update 同步工程索引

## Skills 清单

所有 skills 位于 \`.opencode/skills/\` 目录。

## 流水线状态横幅

每个阶段输出状态横幅：

\`\`\`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 pipeline [■■■□□] Step 3/5 — git-worktree
 功能:    feature-name
 status:  ▶ 开始执行
 下一步:  → Step 4: subagent-dev
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
\`\`\`

## 完成工作后更新

代码变更后同步更新：

1. \`ENGINEERING-INDEX.md\` — 新增/删除了模块、路由、控制器、服务
2. \`.rss/memory/MEMORY.md\` — 踩坑、用户偏好、变更要点
3. \`${fn}\` — 引入了新的约定或命令

## 记忆

持久化记录在 \`.rss/memory/MEMORY.md\`，新会话时先读此文件。
`;
  }
}
