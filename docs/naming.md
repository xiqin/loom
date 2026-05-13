# 命名说明

## loom 是什么

**loom** — AI 工程化框架

## 为什么叫 loom

Loom = 把需求、规范、上下文、执行过程“织”成一套稳定工程流程的系统。

这与传统的"代码驱动"或"工具驱动"的 AI 编程方式不同。loom 要求先理解需求，再规划实现，最后编码交付。

## 包名

- npm 包名：`loom-engineering`
- CLI 命令：`loom`
- GitHub 仓库：`xiqin/loom`

## 内部术语

| 术语             | 含义                                          |
| ---------------- | --------------------------------------------- |
| **skill**        | AI 工具的能力单元，定义在 `SKILL.md` 中       |
| **command**      | 用户可调用的斜杠命令（如 `/loom-brainstorm`） |
| **hook**         | 生命周期钩子（如 session-start）              |
| **pipeline**     | 6 步开发流水线                                |
| **constitution** | 项目宪章（编码准则和技术栈）                  |
| **manifest**     | 安装清单（文件列表和校验和）                  |
| **adapter**      | 工具适配器（如 Claude Code、Cursor）          |
| **subagent**     | 隔离的子 agent，负责单个 task 的实现和审查    |

## 命名约定

- 项目内部标识：`loom`（小写）
- npm 包名：`loom-engineering`（kebab-case）
- CLI 命令：`loom`（小写）
- Skills 目录：kebab-case（如 `brainstorming`、`writing-plans`）
- Commands 文件：kebab-case（如 `loom-brainstorm.md`）
- Hook ID：kebab-case（如 `session-start`）
- Schema ID：camelCase（如 `hooksSupport`）
- 环境变量：`LOOM_*` 前缀（如 `LOOM_NO_COLOR`）
