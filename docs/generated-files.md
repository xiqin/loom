# 生成文件说明

rss 在安装和初始化过程中会生成多种文件。本文档说明每个文件的来源、用途和安全删除策略。

## 安装阶段生成（`rss init`）

### 入口文件

| 文件 | 工具 | 用途 |
|------|------|------|
| `CLAUDE.md` | Claude Code | AI 工具入口文档，包含流水线说明、快速开始、skills 清单 |
| `AGENTS.md` | OpenCode | 同上 |
| `.cursorrules` | Cursor | Cursor 专用入口文件 |
| `.github/copilot-instructions.md` | Copilot | Copilot 专用入口文件 |

入口文件包含 `rss:version=x.y.z` 标记，用于版本检测。删除入口文件后 AI 工具无法识别 rss。

### .rss/ 目录

```
.rss/
├── install-manifest.json     # 安装清单
├── skills/                   # Skills 定义（16 个）
├── commands/                 # Commands 定义（5 个）
├── hooks/                    # Hook 系统
│   ├── hooks.json            # Hook 注册表
│   ├── run-hook.js           # Hook runner
│   ├── session-start         # Shell wrapper
│   └── handlers/
│       └── session-start.cjs # 会话启动处理器
├── templates/                # 项目模板（4 个）
└── core/                     # 核心框架文档（4 个）
```

#### install-manifest.json

记录安装信息：版本、工具、文件列表、SHA-256 校验和、安装时间。卸载器依赖此文件判断文件状态。

#### skills/

16 个 skill 定义文件。每个 skill 包含 `SKILL.md`（定义）和可选的 `REFERENCE/` 目录（参考资料）。

#### commands/

5 个 command 定义文件。每个 command 包含 `.md`（定义）和 `.spec.json`（规格）。

#### hooks/

Hook 系统文件。当前只有一个 hook（session-start），在 Claude Code 会话启动时检测项目初始化状态。

#### templates/

4 个模板文件：`constitution.md`、`project-structure.md`、`rss.md`、`memory.md`。由 `/rss-init-project` 使用。

#### core/

核心框架文档：`pipeline.md`、`review-framework.md`、`progress-tracker.md`、`subagent-context.md`。

### 插件元数据

| 文件 | 工具 | 用途 |
|------|------|------|
| `.claude-plugin/plugin.json` | Claude Code | 插件注册 |
| `.claude-plugin/marketplace.json` | Claude Code | 插件市场 |
| `.opencode/plugin.json` | OpenCode | 插件注册 |

### Claude Code 发现路径

Claude Code 需要 `skills/` 和 `commands/` 在项目根目录才能发现。rss 会将这两个目录同时复制到：

- `.rss/skills/` + `.rss/commands/`（rss 管理的副本）
- `skills/` + `commands/`（项目根目录的副本）

两个副本内容相同。

## 初始化阶段生成（`/rss-init-project`）

运行 `/rss-init-project` 后生成：

| 文件 | 用途 | 可重新生成 |
|------|------|------------|
| `.rss/memory/constitution.md` | 项目宪章（编码准则、技术栈、红线） | ✅ 重新运行 `/rss-init-project` |
| `.rss/rules/project-structure.md` | 工程结构约束 | ✅ 重新运行 `/rss-init-project` |
| `.rss/memory/MEMORY.md` | 记忆文件（踩坑、偏好、状态） | ✅ 重新运行 `/rss-init-project` |
| `rss.md` | 项目入口文档 | ✅ 重新运行 `/rss-init-project` |

### constitution.md

项目宪章，包含：

- 架构原则（分层、依赖注入、配置管理、错误处理、代码生成）
- 技术栈（语言、框架、ORM、数据库、缓存、日志）
- 编码红线（禁止事项）
- 构建/测试/审查命令

### project-structure.md

工程结构约束，包含：

- 目录树
- 架构模式
- 编码红线

### MEMORY.md

记忆文件，包含：

- 技术栈摘要
- 踩坑记录
- 用户偏好
- 变更要点

### rss.md

项目入口文档，包含：

- 项目名称和描述
- 入口文件
- 构建/测试/审查命令

## 流水线阶段生成

运行流水线时生成：

| 文件 | 生成时机 | 用途 |
|------|----------|------|
| `specs/<date+feature>/spec.md` | brainstorming | 需求规格 |
| `specs/<date+feature>/plan.md` | writing-plans | 实现计划 |
| `specs/<date+feature>/progress.md` | brainstorming | 进度追踪 |
| `ENGINEERING-INDEX.md` | index-update | 工程索引 |

## 备份文件

| 文件 | 生成时机 | 用途 |
|------|----------|------|
| `.rss-backup/<timestamp>/` | `--force` 安装 | 冲突文件备份 |

备份目录自动保留最近 3 份，自动加入 `.gitignore`。

## 版本标记

每个生成的文本文件（非 JSON）包含版本标记：

```
<!-- rss:version=1.0.1 -->
```

或在 Markdown frontmatter 中：

```yaml
---
title: 某文件
---
<!-- rss:version=1.0.1 -->
```

版本标记用于：

- `rss doctor` 检测已安装版本
- `rss update` 比较版本号
- `detectInstalledTool()` 检测已安装的工具
- 卸载器的 manifest 工具验证

## 文件所有权

| 文件 | 所有者 | 用户可编辑 |
|------|--------|-----------|
| `CLAUDE.md` / `AGENTS.md` 等入口文件 | rss | ✅ 但卸载时会检测修改 |
| `.rss/skills/` | rss | ✅ 但更新时会覆盖 |
| `.rss/commands/` | rss | ✅ 但更新时会覆盖 |
| `.rss/hooks/` | rss | ✅ 但更新时会覆盖 |
| `.rss/templates/` | rss | ✅ 但更新时会覆盖 |
| `.rss/core/` | rss | ✅ 但更新时会覆盖 |
| `.rss/install-manifest.json` | rss | ✗ 不要手动编辑 |
| `.rss/memory/constitution.md` | 用户 | ✅ 完全可编辑 |
| `.rss/memory/MEMORY.md` | 用户 | ✅ 完全可编辑 |
| `.rss/rules/project-structure.md` | 用户 | ✅ 完全可编辑 |
| `specs/` | 用户 | ✅ 完全可编辑 |
| `rss.md` | 用户 | ✅ 完全可编辑 |
