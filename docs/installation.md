---
title: 安装指南
description: rss 框架安装与配置
---

<!-- rss:version=1.0.0 -->

# 安装指南

## 方式一（推荐）：一键安装脚本

### Unix (macOS / Linux / WSL)

从本地 clone 安装：

```bash
git clone https://github.com/xiqin/rss.git
cd rss
bash install.sh --tool claude-code --link
```

或远程一键安装：

```bash
curl -fsSL https://raw.githubusercontent.com/xiqin/rss/main/install.sh | bash -s -- --tool claude-code
```

### Windows PowerShell

```powershell
irm https://raw.githubusercontent.com/xiqin/rss/main/install.ps1 | iex -Tool claude-code
```

### 安装选项

| Flag | 作用 |
|------|------|
| `--tool <target>` | 目标工具：`claude-code` / `cursor` / `copilot` / `opencode`（可重复） |
| `--force` | 覆盖已有文件（自动备份到 `.rss-backup/`） |
| `--link` | 注册 `rss` CLI 到全局（`npm link`），安装后可直接使用 `rss` 命令 |
| `--dry-run` | 预览，不实际写入 |

示例：

```bash
# 安装到 Claude Code + Cursor，并注册全局 CLI
bash install.sh --tool claude-code --tool cursor --link

# 强制覆盖安装到 OpenCode（备份旧文件）
bash install.sh --tool opencode --force
```

## 方式二：从 npm 安装（发布后可用）

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

- `--tool claude-code` — Claude Code
- `--tool cursor` — Cursor
- `--tool copilot` — GitHub Copilot
- `--tool opencode` — OpenCode

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

## 卸载

### 一键卸载

```bash
# Unix (本地)
bash uninstall.sh --tool claude-code

# Unix (远程)
curl -fsSL https://raw.githubusercontent.com/xiqin/rss/main/uninstall.sh | bash -s -- --tool claude-code

# Windows PowerShell
irm https://raw.githubusercontent.com/xiqin/rss/main/uninstall.ps1 | iex -Tool claude-code
```

同时清理全局 CLI 和备份：

```bash
bash uninstall.sh --tool claude-code --purge
```

### CLI 卸载

```bash
rss uninstall --tool claude-code        # 卸载
rss uninstall --tool claude-code --purge # 卸载 + 清理
```

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
