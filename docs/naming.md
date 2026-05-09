# 命名说明

## rss 是什么

**rss** = **R**equirement-Driven **S**oftware **S**engineering

中文：需求驱动的软件工程

## 为什么叫 rss

rss 强调"需求驱动"的开发理念：

- **Requirement**：从需求出发，不是从代码出发
- **Software**：软件工程，不是脚本编写
- **Sengineering**：工程化，不是随意编码

这与传统的"代码驱动"或"工具驱动"的 AI 编程方式不同。rss 要求先理解需求，再规划实现，最后编码交付。

## 与 RSS 协议的关系

rss（本项目）与 RSS（Really Simple Syndication，简易信息聚合协议）**没有任何关系**。

- RSS 协议用于内容订阅和分发
- rss（本项目）是 AI 工程化框架

两者只是缩写恰好相同。

## 包名

- npm 包名：`rss-engineering`
- CLI 命令：`rss`
- GitHub 仓库：`xiqin/rss`

使用 `rss-engineering` 作为 npm 包名是为了避免与现有 RSS 相关包冲突。

## 内部术语

| 术语 | 含义 |
|------|------|
| **skill** | AI 工具的能力单元，定义在 `SKILL.md` 中 |
| **command** | 用户可调用的斜杠命令（如 `/rss-brainstorm`） |
| **hook** | 生命周期钩子（如 session-start） |
| **pipeline** | 5 步开发流水线 |
| **constitution** | 项目宪章（编码准则和技术栈） |
| **manifest** | 安装清单（文件列表和校验和） |
| **adapter** | 工具适配器（如 Claude Code、Cursor） |
| **subagent** | 隔离的子 agent，负责单个 task 的实现和审查 |

## 命名约定

- 项目内部标识：`rss`（小写）
- npm 包名：`rss-engineering`（kebab-case）
- CLI 命令：`rss`（小写）
- Skills 目录：kebab-case（如 `brainstorming`、`writing-plans`）
- Commands 文件：kebab-case（如 `rss-brainstorm.md`）
- Hook ID：kebab-case（如 `session-start`）
- Schema ID：camelCase（如 `hooksSupport`）
- 环境变量：`RSS_*` 前缀（如 `RSS_NO_COLOR`）
