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
    return [join(projectRoot, '.github', 'copilot-instructions.md')];
  }

  async generate(projectRoot, version, options = {}) {
    const dir = join(projectRoot, '.github');
    mkdirSync(dir, { recursive: true });

    const content = this._buildContent();
    const versioned = injectVersion(content, version, 'text');
    writeFileSync(join(dir, 'copilot-instructions.md'), versioned);
  }

  _buildContent() {
    return `# Copilot Instructions

本项目使用 rss（Requirement-Driven Software Engineering）AI 工程化框架。

## 开发流程

1. brainstorming — 需求头脑风暴，探索 2-3 种实现方案及 trade-off → 输出 spec.md
2. writing-plans — 按分层拆解 task（Model → Service → Controller → Router）→ 输出 plan.md
3. git-worktree — 创建隔离 feature 分支
4. subagent-dev — 派发 implementer + reviewer 编码执行
5. index-update — 同步工程索引 ENGINEERING-INDEX.md

## 编码原则

1. 先思考，再编码 — 显式声明假设，不确定时提问
2. 极简优先 — 只写解决问题的最小代码，不做推测性实现
3. 精准手术 — 只改动必须改动的部分，不"顺便优化"
4. 目标驱动 — 将模糊任务转化为可验证的成功标准

## 使用方式

在 Copilot Chat 中手动触发：

- 需求头脑风暴："请帮我做需求头脑风暴：[需求描述]"
- 拆解计划："请帮我拆解实现计划：根据 spec.md 拆分 task"
- 代码审查："请帮我审查代码：检查当前实现是否符合项目规范"

## 项目规则

- **宪章**：.rss/memory/constitution.md
- **工程约束**：.rss/rules/project-structure.md

## --- USER CUSTOM ---
# 在此添加项目自定义规则，rss update 时不覆盖此区域
`;
  }
}
