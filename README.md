# rss — Requirement-Driven Software Engineering

AI 工程化框架。将 AI 编程工具从"聊天助手"升级为"工程化开发流水线"。

## 核心特性

- **5 步流水线**：brainstorming → writing-plans → git-worktree → subagent-dev → index-update，从需求到交付的完整流程
- **项目宪章自动生成**：`/rss-init-project` 扫描项目源码，自动生成宪章 + 工程结构 + 编码红线
- **5 维代码审查**：架构合规 / 代码质量 / 安全风险 / 性能隐患 / 规范一致性
- **Subagent 隔离派发**：每任务独立派发 implementer + spec-reviewer + quality-reviewer，互不污染上下文
- **Git Worktree 隔离**：每个 feature 独立分支，不污染主分支
- **进度追踪**：progress.md 可视化流水线状态，断点续做
- **多工具兼容**：Claude Code / OpenCode / Cursor / GitHub Copilot

## 安装

### 方式一：一键安装脚本

从本地 clone 的仓库运行：

```bash
git clone https://github.com/xiqin/rss.git
cd rss
bash install.sh --tool claude-code
```

Unix 远程一键安装：

```bash
curl -fsSL https://raw.githubusercontent.com/xiqin/rss/main/install.sh | bash -s -- --tool claude-code
```

Windows PowerShell：

```powershell
irm https://raw.githubusercontent.com/xiqin/rss/main/install.ps1 | iex -Tool claude-code
```

同时安装到多个工具：

```bash
bash install.sh --tool claude-code --tool cursor --link
```

| Flag              | 作用                                                                  |
| ----------------- | --------------------------------------------------------------------- |
| `--tool <target>` | 目标工具：`claude-code` / `cursor` / `copilot` / `opencode`（可重复） |
| `--force`         | 覆盖已有文件（自动备份）                                              |
| `--link`          | 注册 `rss` CLI 到全局（`npm link`）                                   |
| `--dry-run`       | 预览，不实际写入                                                      |

### 方式二：从 npm 安装

```bash
npm i -g rss-engineering
```

在项目根目录运行：

```bash
# Claude Code
rss init --tool claude-code

# OpenCode
rss init --tool opencode

# Cursor
rss init --tool cursor

# GitHub Copilot
rss init --tool copilot
```

### 安装后验证

```bash
rss doctor    # 诊断安装状态
rss list      # 列出可用 skills 和 commands
```

## 快速开始

1. 运行 `rss init --tool <target>` 安装框架
2. 在 AI 工具中运行 `/rss-init-project` 扫描项目并生成配置
3. 使用 `/rss-brainstorm <需求描述>` 开始需求分析
4. 按流水线逐步执行

## 流水线详解

```
brainstorming → writing-plans → git-worktree → subagent-dev → index-update
```

| Step | 阶段                        | 说明                                      | 输出                           |
| ---- | --------------------------- | ----------------------------------------- | ------------------------------ |
| 1    | brainstorming               | 需求头脑风暴，探索 2-3 种方案及 trade-off | `specs/<date+feature>/spec.md` |
| 2    | writing-plans               | 按项目架构分层拆解 task                   | `specs/<date+feature>/plan.md` |
| 3    | git-worktree                | 创建隔离 feature 分支                     | feature 分支                   |
| 4    | subagent-driven-development | Subagent 隔离派发 + 双审查                | 源码 + 测试                    |
| 5    | index-update                | 同步工程索引、记忆文件、入口文档          | ENGINEERING-INDEX.md           |

## Commands（斜杠命令）

| 命令                | 说明                                   |
| ------------------- | -------------------------------------- |
| `/rss-init-project` | 扫描项目，生成宪章、工程结构、记忆文件 |
| `/rss-brainstorm`   | 需求头脑风暴，探索方案，输出 spec.md   |
| `/rss-write-plan`   | 按分层拆解实现计划，输出 plan.md       |
| `/rss-execute-plan` | 派发 subagent 执行编码 + 审查          |
| `/rss-import-rules` | 导入已有项目规则到 rss 框架            |

## Skills（15 个）

### 核心流水线

| Skill                       | 说明                                              |
| --------------------------- | ------------------------------------------------- |
| brainstorming               | 需求头脑风暴，可视化伴侣，设计自检，用户审查 Gate |
| writing-plans               | 分层拆解 task，模型选择，类型一致性检查           |
| using-git-worktrees         | Git worktree 隔离，测试基线验证                   |
| subagent-driven-development | Subagent 派发 + 独立审查，4 种状态处理            |
| index-update                | 工程索引同步，自动更新 MEMORY.md 和入口文档       |

### 辅助

| Skill        | 说明                               |
| ------------ | ---------------------------------- |
| init-project | 项目初始化（扫描 + 生成宪章/结构） |
| using-rss    | rss 框架使用指南                   |

### 通用（继承 superpowers）

test-driven-development / systematic-debugging / verification-before-completion / finishing-a-development-branch / requesting-code-review / receiving-code-review / dispatching-parallel-agents / writing-skills

## 项目结构

安装后在目标项目中生成：

```
项目根目录/
├── .rss/
│   ├── memory/
│   │   ├── constitution.md        # 项目宪章
│   │   └── MEMORY.md              # 记忆文件
│   ├── rules/
│   │   └── project-structure.md   # 工程结构约束
│   ├── skills/                    # Skills 定义
│   ├── commands/                  # Commands 定义
│   ├── hooks/                     # 会话钩子
│   ├── templates/                 # 模板文件
│   └── core/                      # 核心框架
├── CLAUDE.md                      # Claude Code 入口
├── AGENTS.md                      # OpenCode 入口
└── specs/                         # 需求规格（按需生成）
    └── <date+feature>/
        ├── spec.md
        ├── plan.md
        └── progress.md
```

## CLI 参考

```bash
rss init --tool <target>              # 安装到项目
  --force                             # 覆盖已有文件（自动备份）
  --dry-run                           # 预览，不写入

rss update                            # 更新已安装文件
rss doctor                            # 诊断安装状态
rss list [--type skills|commands|all] # 列出可用资源
rss uninstall --tool <target>         # 卸载
  --purge                             # 同时清理 .gitignore 和备份目录
```

## 与 superpowers 的关系

rss 继承 superpowers 的插件基础设施，替换/增强核心 skills 为 rss 版本（增加流水线、宪章、审查维度等），并新增项目规则自动生成、进度追踪、索引同步等能力。

## License

MIT
