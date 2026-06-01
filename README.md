# loom — Weave Specs into Execution

AI 工程化框架。把需求、规范、上下文、执行过程"织"成一套稳定工程流程。

## loom 是什么

- 一套 **skills + commands + hooks** 的集合，注入到 AI 编程工具中
- 一条 **按任务类型自适应的开发流水线**：根据 `feature / bugfix / hotfix / refactor / chore` 自动选择对应步骤
- 一个 **CLI 工具**（`loom`），负责安装、更新、诊断、卸载，以及流水线执行（`run`/`status`/`tasks`/`index`）、结构化记忆（`memory`）和 MCP server（`mcp-serve`）
- 一个 **项目初始化器**（`/loom-init-project` 或 `loom init-project`），自动扫描项目生成宪章和工程结构

从需求描述出发，经过头脑风暴、计划拆解、隔离开发、代码审查，最终交付。

## 支持工具矩阵

| 工具           | 支持等级 | 入口文件                          | Skills | Hooks | Plugin 注册 |
| -------------- | -------- | --------------------------------- | ------ | ----- | ----------- |
| Claude Code    | full     | `CLAUDE.md`                       | ✅     | ✅    | ✅          |
| Codex          | full     | `AGENTS.md`                       | ✅     | ✗     | ✗           |
| Cursor         | full     | `.cursor/rules/*.mdc`             | ✅     | ✗     | ✗           |
| GitHub Copilot | full     | `.github/copilot-instructions.md` | ✅     | ✗     | ✗           |
| OpenCode       | full     | `AGENTS.md`                       | ✅     | ✗     | ✅          |

- **full**：完整支持，适配器已实现
- **planned**：计划中，适配器待实现
- **Hooks**：仅 Claude Code 支持会话级钩子（session-start）

## 安装

### 前置条件

- Node.js >= 18
- （可选）[codegraph](https://github.com/colbymchenry/codegraph) — 装了则 `loom index` 自动委派给它做 AST 级图索引，并注册其 MCP server；未装则回落自带静态扫描器

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
irm https://raw.githubusercontent.com/xiqin/loom/main/install.ps1 -OutFile install.ps1; .\install.ps1 -Tool claude-code
```

### 方式二：npm 安装

```bash
npm i -g loom-engineering
loom install --tool claude-code
```

### 安装选项

| Flag              | 作用                                     |
| ----------------- | ---------------------------------------- |
| `--tool <target>` | 目标工具（必填，可重复）                 |
| `--dry-run`       | 预览，不实际写入                         |
| `--from-release`  | 从 GitHub release tag 下载（可重现安装） |
| `--version <ver>` | 指定下载版本（配合 `--from-release`）    |

### 安装后验证

```bash
loom doctor    # 诊断安装状态
loom list      # 列出可用 skills 和 commands
```

### 初始化项目上下文

在 Codex/Claude/OpenCode 中直接触发 `loom-init-project` skill 即可；脚本由 skill 自动运行，不需要用户手动调用。

也可以使用 CLI：

```bash
loom init-project
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
#   Version: 2.0.1
#   Status: installed
```

## 流水线

流水线由 `.loom/workflow.yaml` 集中定义，支持按任务类型自动选择对应流水线，执行时由 AI 读取 yaml 动态调度。

### 流水线类型

| 类型       | 适用场景                         | 包含步骤                                                    |
| ---------- | -------------------------------- | ----------------------------------------------------------- |
| `feature`  | 新功能开发                       | brainstorming → planning → approved → git-worktree → executing → verification → synced |
| `bugfix`   | 已定位的 bug 修复                | planning → approved → executing → verification → synced     |
| `hotfix`   | 生产紧急问题                     | approved → executing → verification                         |
| `refactor` | 代码重构                         | brainstorming → planning → approved → executing → verification → synced |
| `chore`    | 依赖升级、配置调整、文档更新等   | executing → verification                                    |

AI 收到任务后会先判断类型并告知用户，确认后再读取对应流水线执行。未指定类型时默认使用 `feature`。

### feature 流水线步骤

| Step | 阶段                        | 说明                                     | 输出                             |
| ---- | --------------------------- | ---------------------------------------- | -------------------------------- |
| 1    | brainstorming               | 需求头脑风暴，探索 2-3 种实现方案        | `specs/<date+feature>/spec.md`   |
| 2    | writing-plans               | 按分层拆解 task                          | `specs/<date+feature>/plan.md`   |
| 3    | git-worktree                | 创建隔离分支                             | feature 分支                     |
| 4    | subagent-driven-development | Subagent 隔离派发 + 双审查               | 源码 + 测试报告                  |
| 5    | verification                | 完成前验证，Spec覆盖/类型一致性/编译测试 | 验证报告                         |
| 6    | index-update                | 工程索引同步（`loom index` 自动选 codegraph 或静态扫描） | codegraph 图索引 或 engineering-index.md |

### 代码审查

<!-- loom:generate:review-summary -->
### 6 维审查

| 维度 | 关键检查项 |
|------|----------|
| 架构合规 | 是否遵循项目架构分层（从 project-structure.md 读取）、是否存在跨层调用 |
| 代码质量 | 是否使用了项目禁止的调试函数、SQL 是否参数化（防注入） |
| 安全风险 | SQL 注入检查、认证/授权是否正确 |
| 性能隐患 | N+1 查询检查、分页查询是否使用框架分页组件 |
| 规范一致性 | 命名是否符合项目规范、响应格式是否统一 |
| 变更影响范围 | 本次变更的函数、接口、类型是否被其他模块引用（codegraph 可用时查 codegraph_impact/codegraph_callers，否则读 engineering-index.md）、公开接口的参数签名是否变化（新增必填参数、删除字段、类型变更） |
<!-- /loom:generate:review-summary -->

## Skills（15 个）

<!-- loom:generate:skills-catalog -->
6 流水线 + 2 辅助 + 7 通用 Skill，共 15 个

**核心流水线 Skills：**

| Skill                               | 输出                           | 说明                                               |
| ----------------------------------- | ------------------------------ | -------------------------------------------------- |
| loom-brainstorming | `specs/<date+feature>/spec.md` | 需求头脑风暴, +可视化伴侣、设计自检、用户审查 Gate |
| loom-writing-plans | `specs/<date+feature>/plan.md` | 分层拆解 task, +模型选择、类型一致性检查 |
| loom-using-git-worktrees | feature 分支 | 创建隔离分支, +测试基线验证 |
| loom-subagent-driven-development | 源码 + 测试报告 | Subagent 派发 + 双重审查,独立模板文件、4种状态处理 |
| loom-verification-before-completion | 验证报告 | 完成前验证, +Spec覆盖、类型一致性、编译测试 |
| loom-index-update | 知识图谱 或 ENGINEERING-INDEX.md | 工程索引同步 |

**辅助 Skills：**

| Skill             | 说明                               |
| ----------------- | ---------------------------------- |
| loom-init-project | 项目初始化（扫描 + 生成宪章/结构） |
| loom-using-loom | loom 框架使用指南（本 skill） |

**通用 Skills：**

| Skill                               | 说明                                              |
| ----------------------------------- | ------------------------------------------------- |
| loom-test-driven-development | TDD 测试驱动开发，+流程图、好/坏示例、常见借口表 |
| loom-systematic-debugging | 系统化调试, +4阶段流程图、条件等待、纵深防御 |
| loom-requesting-code-review | 请求代码审查, +预审查清单、审查模板 |
| loom-receiving-code-review | 接受代码审查, +响应模板、流程图 |
| loom-dispatching-parallel-agents | 并行 agent 派发, +模型选择、并发工作流图 |
| loom-writing-skills | 编写自定义 skills, +方法论深度、流程图 |
| loom-finishing-a-development-branch | 分支完成流程 , +选项展示（Merge/PR/Keep/Discard） |

> 完整定义详见 `skills/loom-using-loom/SKILL.md` 或 `.loom/skills/` 目录
<!-- /loom:generate:skills-catalog -->

## License

MIT