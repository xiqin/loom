---
title: 安装指南
description: rss 框架安装与配置
---

<!-- rss:version=1.0.0 -->

# 安装指南

## CLI 安装（推荐）

### 1. 全局安装 CLI

```bash
npm i -g rss-engineering
```

### 2. 初始化项目

在项目根目录运行：

```bash
rss init --tool claude-code
```

这会将 skills、commands、hooks、templates 复制到 `.rss/` 目录，并生成入口文档（`CLAUDE.md` / `AGENTS.md`）。

支持的工具：

- `--tool claude-code` — Claude Code（默认）
- `--tool cursor` — Cursor
- `--tool copilot` — GitHub Copilot

### 3. 初始化项目配置

在 AI 编程工具中运行：

```
/rss-init-project
```

这会扫描项目并生成：

- `.rss/memory/constitution.md`（项目宪章）
- `.rss/rules/project-structure.md`（工程结构）
- `.rss/memory/MEMORY.md`（记忆文件）
- `.rss/templates/subagent-context.md`（子 agent 上下文）

## 更新

```bash
rss update
```

## 安装后验证

- [ ] 运行 `rss doctor` 确认安装状态
- [ ] 检查 `.rss/` 目录中的文件是否已生成
- [ ] 确认入口文档（`CLAUDE.md` / `AGENTS.md`）已创建在项目根目录
- [ ] 运行 `rss list` 查看可用 skills 和 commands

## 诊断

```bash
rss doctor
```

## 列出可用 Skills

```bash
rss list
```

## Git Hook 配置（可选）

```bash
git config core.hooksPath .githooks
```

> ⚠️ `core.hooksPath` 会替换项目所有 git hooks。如果你项目已有自定义 hooks（如 pre-commit），它们会被忽略。建议将项目 hooks 与 rss hooks 合并到 `.githooks/` 目录中。
