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
| Claude Code    | full     | `.claude/CLAUDE.md`               | ✅¹    | ✅    | ✗²          |
| Cursor         | full     | `.cursorrules`                    | ✅     | ✗     | ✗           |
| GitHub Copilot | full     | `.github/copilot-instructions.md` | ✅     | ✗     | ✗           |
| OpenCode       | full     | `AGENTS.md`                       | ✅³    | ✗     | ✅          |

- **full**：完整支持，适配器已实现
- **planned**：计划中，适配器待实现
- **Hooks**：仅 Claude Code 支持会话级钩子（session-start）
- ¹ Claude Code 的 skills/commands 位于 `.claude/skills/*.md` 和 `.claude/commands/*.md`，通过 `@.loom/...` 引用完整定义
- ² Claude Code 原生发现 `.claude/` 目录，无需额外插件注册
- ³ OpenCode 的 skills/commands 位于 `.opencode/skills/*.md` 和 `.opencode/commands/*.md`，通过 `@.loom/...` 引用完整定义

## 安装方式与安全等级

| 安装方式                | 命令                                        | 安全等级 | 说明                             |
| ----------------------- | ------------------------------------------- | -------- | -------------------------------- |
| 本地 clone + bash       | `bash install.sh --tool claude-code`        | ★★★ 最高 | 代码可见，可审计，可 dry-run     |
| 本地 clone + PowerShell | `.\install.ps1 -tool claude-code`           | ★★★ 最高 | 同上，Windows 平台               |
| npm 全局安装            | `npm i -g loom-engineering && loom init`    | ★★☆ 中等 | 从 npm registry 拉取，需信任 npm |
| 远程 curl-pipe          | `curl ... \| bash -s -- --tool claude-code` | ★☆☆ 最低 | 直接执行远程脚本，适合 CI/CD     |

**安全建议**：

- 生产环境推荐本地 clone 方式，可审计脚本内容
- 所有安装方式均支持 `--dry-run` 预览，不实际写入
- 安装前自动检测冲突，冲突文件自动备份到 `.loom-backup/`
- 卸载时基于 SHA-256 校验和判断文件是否被修改，修改过的文件不会被删除

## 安装

### 前置条件

- Node.js >= 18

### 方式一：本地安装

```bash
git clone https://github.com/xiqin/loom.git
cd loom
bash install.sh --tool claude-code
```

### 方式二：npm 安装

```bash
npm i -g loom-engineering
cd your-project
loom init --tool claude-code
```

### 方式三：远程一键安装

```bash
# Unix
curl -fsSL https://raw.githubusercontent.com/xiqin/loom/main/install.sh | bash -s -- --tool claude-code

# Windows PowerShell
irm https://raw.githubusercontent.com/xiqin/loom/main/install.ps1 | iex -tool claude-code
```

### 安装选项

| Flag              | 作用                                     |
| ----------------- | ---------------------------------------- |
| `--tool <target>` | 目标工具（必填）                         |
| `--force`         | 覆盖已有文件（自动备份）                 |
| `--dry-run`       | 预览，不实际写入                         |
| `--from-release`  | 从 GitHub release tag 下载（可重现安装） |
| `--version <ver>` | 指定版本（默认脚本内嵌版本）             |

### 安装后验证

```bash
loom doctor    # 诊断安装状态
loom list      # 列出可用 skills 和 commands
```

## 初始化前后目录对比

### 安装前

```
my-project/
├── src/
├── package.json
└── ...
```

### 安装后（以 Claude Code 为例）

```
my-project/
├── .claude/
│   ├── CLAUDE.md                      # ← loom 生成：入口文档
│   ├── skills/                        # ← loom 生成：skill 包装器（@.loom/...）
│   └── commands/                      # ← loom 生成：command 包装器（@.loom/...）
├── .loom/
│   ├── install-manifest.json          # ← loom 生成：安装清单
│   ├── skills/                        # ← loom 生成：15 个 skills（完整定义）
│   ├── commands/                      # ← loom 生成：5 个 commands
│   ├── hooks/                         # ← loom 生成：会话钩子
│   ├── templates/                     # ← loom 生成：项目模板
│   ├── core/                          # ← loom 生成：核心框架文档
│   └── schema/                        # ← loom 生成：模板模式
├── src/
├── package.json
└── ...
```

### 安装后（以 OpenCode 为例）

```
my-project/
├── AGENTS.md                          # ← loom 生成：入口文档
├── .opencode/
│   ├── skills/                        # ← loom 生成：skill 包装器（@.loom/...）
│   └── commands/                      # ← loom 生成：command 包装器（@.loom/...）
├── .loom/
│   ├── install-manifest.json          # ← loom 生成：安装清单
│   ├── skills/                        # ← loom 生成：15 个 skills（完整定义）
│   ├── commands/                      # ← loom 生成：5 个 commands
│   ├── hooks/                         # ← loom 生成：会话钩子
│   ├── templates/                     # ← loom 生成：项目模板
│   ├── core/                          # ← loom 生成：核心框架文档
│   └── schema/                        # ← loom 生成：模板模式
├── src/
├── package.json
└── ...
```

### 运行 `/loom-init-project` 后

```
my-project/
├── .claude/
│   └── CLAUDE.md
├── .loom/
│   ├── memory/
│   │   ├── constitution.md            # ← init-project 生成：项目宪章
│   │   ├── MEMORY.md                  # ← init-project 生成：记忆文件
│   │   └── loom.md                    # ← init-project 生成：项目入口文档
│   ├── rules/
│   │   └── project-structure.md       # ← init-project 生成：工程结构约束
│   └── ...
└── ...
```

## 生成文件说明

| 文件                               | 生成时机                | 用途                                     | 可安全删除          |
| ---------------------------------- | ----------------------- | ---------------------------------------- | ------------------- |
| `.claude/CLAUDE.md`                | `loom init`             | Claude Code 入口文档                     | ✗                   |
| `.claude/skills/`                  | `loom init`             | Skill 包装器（引用 `.loom/skills/`）     | ✗                   |
| `.claude/commands/`                | `loom init`             | Command 包装器（引用 `.loom/commands/`） | ✗                   |
| `.loom/skills/`                    | `loom init`             | Skills 完整定义（单一事实源）            | ✗                   |
| `.loom/commands/`                  | `loom init`             | Commands 完整定义                        | ✗                   |
| `.loom/hooks/`                     | `loom init`             | 会话钩子及处理器                         | ✗                   |
| `.loom/templates/`                 | `loom init`             | 项目模板                                 | ✗                   |
| `.loom/core/`                      | `loom init`             | 核心框架文档                             | ✗                   |
| `.loom/install-manifest.json`      | `loom init`             | 安装清单（文件列表 + SHA-256 校验和）    | ✗（卸载依赖此文件） |
| `.loom/memory/constitution.md`     | `/loom-init-project`    | 项目宪章（编码准则、技术栈、红线）       | ✓（可重新生成）     |
| `.loom/memory/MEMORY.md`           | `/loom-init-project`    | 记忆文件（踩坑、偏好、状态）             | ✓（可重新生成）     |
| `.loom/rules/project-structure.md` | `/loom-init-project`    | 工程结构约束                             | ✓（可重新生成）     |
| `.loom/memory/loom.md`             | `/loom-init-project`    | 项目入口文档                             | ✓（可重新生成）     |
| `specs/<date+feature>/`            | 流水线执行              | 需求规格、实现计划、进度追踪             | ✓（项目数据）       |
| `.loom-backup/`                    | `--force` 安装          | 冲突文件备份（自动保留最近 3 份）        | ✓                   |
| `AGENTS.md`                        | `loom init`（OpenCode） | OpenCode 入口文档                        | ✗                   |
| `.opencode/skills/`                | `loom init`（OpenCode） | Skill 包装器（引用 `.loom/skills/`）     | ✗                   |
| `.opencode/commands/`              | `loom init`（OpenCode） | Command 包装器（引用 `.loom/commands/`） | ✗                   |

## 卸载与恢复策略

### 卸载

```bash
# 脚本卸载
bash uninstall.sh --tool claude-code
.\uninstall.ps1 -tool claude-code

# CLI 卸载
loom uninstall --tool claude-code
```

### 卸载安全策略

卸载器基于 `install-manifest.json` 中的 SHA-256 校验和判断文件状态：

| 文件状态               | 行为                   |
| ---------------------- | ---------------------- |
| 未修改（校验和匹配）   | 安全删除               |
| 已修改（校验和不匹配） | 跳过，输出 warning     |
| 已不存在               | 跳过                   |
| 无 manifest            | 拒绝卸载，提示手动删除 |

**这意味着**：如果你修改了 loom 生成的文件，卸载时不会删除它们。你不会丢失任何手动修改。

### 完全清理

```bash
loom uninstall --tool claude-code --purge
```

`--purge` 额外清理：

- `.loom-backup/` 备份目录
- `.gitignore` 中的 loom 条目

### 恢复

如果误卸载，重新安装即可：

```bash
loom init --tool claude-code
```

如果需要恢复被 `--force` 覆盖的文件：

```bash
ls .loom-backup/           # 查看备份
cp .loom-backup/<file> .   # 手动恢复
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

## CLI 参考

```bash
loom init --tool <target>              # 安装：资产到 .loom/，包装器到工具目录
  --force                             # 覆盖已有文件（自动备份）
  --dry-run                           # 预览，不写入

loom update                            # 重新同步 .loom/ 资产和工具包装器
loom doctor                            # 诊断安装状态
loom list [--type skills|commands|all] # 列出可用资源
loom uninstall --tool <target>         # 移除 manifest 跟踪的生成文件
  --purge                             # 同时清理备份和 .gitignore 条目
```

## 与 superpowers 的关系

loom 继承 superpowers 的插件基础设施，替换/增强核心 skills 为 loom 版本（增加流水线、宪章、审查维度等），并新增项目规则自动生成、进度追踪、索引同步等能力。

## 已知限制

- **`/loom-import-rules` 未实现**：命令定义存在但功能未开发
- **Hooks 仅支持 Claude Code**：其他工具不支持会话级钩子
- **远程安装需要 curl + tar**：`--from-release` 模式依赖系统工具
- **Windows 远程安装需要 tar**：PowerShell 脚本的 `-FromRelease` 模式需要 tar 命令
- **Node.js >= 18 硬性要求**：不支持更低版本
- **单项目单工具**：一个项目同时只能安装一个工具的适配器
- **流水线依赖 Git**：git-worktree 步骤需要 Git 仓库
- **子 agent 上下文隔离**：subagent 无法访问主 agent 的完整上下文

## License

MIT
