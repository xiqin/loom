# loom — Weave Specs into Execution

AI 工程化框架。把需求、规范、上下文、执行过程"织"成一套稳定工程流程。

## loom 是什么

- 一套 **skills + commands + hooks** 的集合，注入到 AI 编程工具中
- 一条 **5 步开发流水线**：需求分析 → 计划拆解 → 隔离开发 → 代码审查 → 索引同步
- 一个 **CLI 工具**（`loom`），负责安装、更新、诊断、卸载
- 一个 **项目初始化器**（`/loom-init-project`），自动扫描项目生成宪章和工程结构

从需求描述出发，经过头脑风暴、计划拆解、隔离开发、代码审查，最终交付。

## 支持工具矩阵

| 工具           | 支持等级 | 入口文件                          | Skills | Hooks | Plugin 注册 |
| -------------- | -------- | --------------------------------- | ------ | ----- | ----------- |
| Claude Code    | full     | `.claude/CLAUDE.md`               | ✅     | ✅    | ✅          |
| Cursor         | full     | `.cursorrules`                    | ✅     | ✗     | ✗           |
| GitHub Copilot | full     | `.github/copilot-instructions.md` | ✅     | ✗     | ✗           |
| OpenCode       | full     | `AGENTS.md`                       | ✅     | ✗     | ✅          |

- **full**：完整支持，适配器已实现
- **planned**：计划中，适配器待实现
- **Hooks**：仅 Claude Code 支持会话级钩子（session-start）

## 安装

### 前置条件

- Node.js >= 18

### 方式一：一键安装脚本

```bash
git clone https://github.com/xiqin/loom.git
cd loom
bash install.sh --tool claude-code
```

远程一键安装：

```bash
# Unix
curl -fsSL https://raw.githubusercontent.com/xiqin/loom/main/install.sh | bash -s -- --tool claude-code

# Windows PowerShell
irm https://raw.githubusercontent.com/xiqin/loom/main/install.ps1 | iex -Tool claude-code
```

### 方式二：npm 安装

```bash
npm i -g loom-engineering
loom install --tool claude-code
```

### 安装选项

| Flag              | 作用                                     |
| ----------------- | ---------------------------------------- |
| `--tool <target>` | 目标工具（必填）                         |
| `--dry-run`       | 预览，不实际写入                         |
| `--from-release`  | 从 GitHub release tag 下载（可重现安装） |

### 安装后验证

```bash
loom doctor    # 诊断安装状态
loom list      # 列出可用 skills 和 commands
```

## 卸载

### 卸载

```bash
# 脚本卸载
bash uninstall.sh --tool claude-code
.\uninstall.ps1 -Tool claude-code

# CLI 卸载
loom uninstall --tool claude-code
```

卸载只清理用户级安装的文件（用户目录下的 skills、commands、plugin 注册），不碰项目目录中的任何文件。

### 恢复

如果误卸载，重新安装即可：

```bash
loom install --tool claude-code
```

## 版本与发布策略

- 遵循 [Semantic Versioning](https://semver.org/)
- 版本号在 `package.json` 中定义，通过 `scripts/sync-version.mjs` 同步到所有元数据文件
- 每个生成的文件包含 `loom:version=x.y.z` 标记，用于检测已安装版本
- `loom update` 自动比较版本号，仅在版本不同时更新
- `loom doctor` 显示当前安装状态和版本

### 版本检查

```bash
loom doctor
# 输出示例：
#   Tool: claude-code
#   Version: 1.0.1
#   Status: installed
```

## 流水线

```
brainstorming → writing-plans → git-worktree → subagent-dev → index-update
```

| Step | 阶段                        | 说明                                      | 输出                           |
| ---- | --------------------------- | ----------------------------------------- | ------------------------------ |
| 1    | brainstorming               | 需求头脑风暴，探索 2-3 种方案及 trade-off | `specs/<date+feature>/spec.md` |
| 2    | writing-plans               | 按项目架构分层拆解 task                   | `specs/<date+feature>/plan.md` |
| 3    | git-worktree                | 创建隔离 feature 分支                     | feature 分支                   |
| 4    | subagent-driven-development | Subagent 隔离派发 + 双审查                | 源码 + 测试                    |
| 5    | index-update                | 同步工程索引、记忆文件                    | ENGINEERING-INDEX.md           |

### 代码审查（5 维）

1. 架构合规 — 分层正确性、循环依赖
2. 代码质量 — 编码规范、错误处理、日志
3. 安全风险 — SQL 注入、认证、输入验证
4. 性能隐患 — N+1 查询、缓存策略
5. 规范一致性 — 命名、响应格式、数据模型

## Commands

| 命令                 | 说明                                   |
| -------------------- | -------------------------------------- |
| `/loom-init-project` | 扫描项目，生成宪章、工程结构、记忆文件 |
| `/loom-brainstorm`   | 需求头脑风暴，探索方案，输出 spec.md   |
| `/loom-write-plan`   | 按分层拆解实现计划，输出 plan.md       |
| `/loom-execute-plan` | 派发 subagent 执行编码 + 审查          |
| `/loom-import-rules` | 导入已有项目规则到 loom 框架（待实现） |

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
| using-loom   | loom 框架使用指南                  |

### 通用（继承 superpowers）

test-driven-development / systematic-debugging / verification-before-completion / finishing-a-development-branch / requesting-code-review / receiving-code-review / dispatching-parallel-agents / writing-skills

## 与 superpowers 的关系

loom 继承 superpowers 的插件基础设施，替换/增强核心 skills 为 loom 版本（增加流水线、宪章、审查维度等），并新增项目规则自动生成、进度追踪、索引同步等能力。

## License

MIT
