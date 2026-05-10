# 生成文件说明

loom 在安装和初始化过程中会生成多种文件。本文档说明每个文件的来源、用途和安全删除策略。

## 安装阶段生成（`loom init`）

### 入口文件

| 文件                              | 工具        | 用途                                                   |
| --------------------------------- | ----------- | ------------------------------------------------------ |
| `CLAUDE.md`                       | Claude Code | AI 工具入口文档，包含流水线说明、快速开始、skills 清单 |
| `AGENTS.md`                       | OpenCode    | 同上                                                   |
| `.cursorrules`                    | Cursor      | Cursor 专用入口文件                                    |
| `.github/copilot-instructions.md` | Copilot     | Copilot 专用入口文件                                   |

入口文件包含 `loom:version=x.y.z` 标记，用于版本检测。删除入口文件后 AI 工具无法识别 loom。

### .loom/ 目录

```
.loom/
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

4 个模板文件：`constitution.md`、`project-structure.md`、`loom.md`、`memory.md`。由 `/loom-init-project` 使用。

#### core/

核心框架文档：`pipeline.md`、`review-framework.md`、`progress-tracker.md`、`subagent-context.md`。

### OpenCode 发现路径

OpenCode 通过 `.opencode/` 目录发现 skills 和 commands。loom 会在 `.opencode/` 下生成 wrapper 文件，通过 `@` 引用指向 `.loom/` 中的真实定义：

- `.opencode/skills/<name>.md` — 包含 `@.loom/skills/<name>/SKILL.md` 引用
- `.opencode/commands/<name>.md` — 包含 `@.loom/commands/<name>.md` 引用
- `AGENTS.md` — 入口文档，引用 `.loom/` 下的核心框架文档

`.loom/` 是唯一维护点，`.opencode/` 仅为 OpenCode 的发现层。

### 插件元数据

| 文件                    | 工具     | 用途     |
| ----------------------- | -------- | -------- |
| `.opencode/plugin.json` | OpenCode | 插件注册 |

### Claude Code 发现路径

Claude Code 通过 `.claude/` 目录发现 skills 和 commands。loom 会在 `.claude/` 下生成 wrapper 文件，通过 `@` 引用指向 `.loom/` 中的真实定义：

- `.claude/skills/<name>.md` — 包含 `@.loom/skills/<name>/SKILL.md` 引用
- `.claude/commands/<name>.md` — 包含 `@.loom/commands/<name>.md` 引用
- `.claude/CLAUDE.md` — 入口文档，引用 `.loom/` 下的核心框架文档

`.loom/` 是唯一维护点，`.claude/` 仅为 Claude Code 的发现层。

## 初始化阶段生成（`/loom-init-project`）

运行 `/loom-init-project` 后生成：

| 文件                               | 用途                               | 可重新生成                       |
| ---------------------------------- | ---------------------------------- | -------------------------------- |
| `.loom/memory/constitution.md`     | 项目宪章（编码准则、技术栈、红线） | ✅ 重新运行 `/loom-init-project` |
| `.loom/rules/project-structure.md` | 工程结构约束                       | ✅ 重新运行 `/loom-init-project` |
| `.loom/memory/MEMORY.md`           | 记忆文件（踩坑、偏好、状态）       | ✅ 重新运行 `/loom-init-project` |
| `.loom/loom.md`                    | 项目入口文档                       | ✅ 重新运行 `/loom-init-project` |

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

### loom.md

项目入口文档，包含：

- 项目名称和描述
- 入口文件
- 构建/测试/审查命令

## 流水线阶段生成

运行流水线时生成：

| 文件                               | 生成时机      | 用途     |
| ---------------------------------- | ------------- | -------- |
| `specs/<date+feature>/spec.md`     | brainstorming | 需求规格 |
| `specs/<date+feature>/plan.md`     | writing-plans | 实现计划 |
| `specs/<date+feature>/progress.md` | brainstorming | 进度追踪 |
| `ENGINEERING-INDEX.md`             | index-update  | 工程索引 |

## 备份文件

| 文件                        | 生成时机       | 用途         |
| --------------------------- | -------------- | ------------ |
| `.loom-backup/<timestamp>/` | `--force` 安装 | 冲突文件备份 |

备份目录自动保留最近 3 份，自动加入 `.gitignore`。

## 版本标记

每个生成的文本文件（非 JSON）包含版本标记：

```
<!-- loom:version=当前版本号 -->
```

或在 Markdown frontmatter 中：

```yaml
---
title: 某文件
---
<!-- loom:version=当前版本号 -->
```

版本标记用于：

- `loom doctor` 检测已安装版本
- `loom update` 比较版本号
- `detectInstalledTool()` 检测已安装的工具
- 卸载器的 manifest 工具验证

## 文件所有权

| 文件                                 | 所有者 | 用户可编辑            |
| ------------------------------------ | ------ | --------------------- |
| `CLAUDE.md` / `AGENTS.md` 等入口文件 | loom   | ✅ 但卸载时会检测修改 |
| `.loom/skills/`                      | loom   | ✅ 但更新时会覆盖     |
| `.loom/commands/`                    | loom   | ✅ 但更新时会覆盖     |
| `.loom/hooks/`                       | loom   | ✅ 但更新时会覆盖     |
| `.loom/templates/`                   | loom   | ✅ 但更新时会覆盖     |
| `.loom/core/`                        | loom   | ✅ 但更新时会覆盖     |
| `.loom/install-manifest.json`        | loom   | ✗ 不要手动编辑        |
| `.loom/memory/constitution.md`       | 用户   | ✅ 完全可编辑         |
| `.loom/memory/MEMORY.md`             | 用户   | ✅ 完全可编辑         |
| `.loom/rules/project-structure.md`   | 用户   | ✅ 完全可编辑         |
| `specs/`                             | 用户   | ✅ 完全可编辑         |
| `.loom/loom.md`                      | 用户   | ✅ 完全可编辑         |
