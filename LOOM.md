# loom — Weave Specs into Execution

## 核心流水线

```
brainstorming → writing-plans → git-worktree → subagent-dev → index-update
```

## 项目规则

- **宪章**：`.loom/memory/constitution.md`（由 `/loom-init-project` 自动生成）
- **工程约束**：`.loom/project-structure.md`（由 `/loom-init-project` 自动生成）

**所有开发活动必须遵守以上两份文件。**

## 快速开始

1. 安装 loom 框架（参见 `docs/installation.md`）
2. 首次使用请运行 `/loom-init-project` 扫描项目并生成配置
3. 使用 `/loom-brainstorm` 开始需求分析，生成 `specs/<date+feature>/spec.md`
4. 使用 `/loom-write-plan` 拆解实现计划，生成 `plan.md`
5. 使用 `/loom-execute-plan` 派发 subagent 执行编码
6. 编码完成后自动触发 index-update 同步工程索引

## Skills 清单

所有 skills 通过 `/` 命令或 Skill 工具调用。详见 `skills/` 目录。

**融合说明：** loom 继承 superpowers 并融合两者优点，包含流程图、自检清单、反模式、常见误区等增强特性。

### 核心流水线 Skills（融合增强）

| Skill                       | 说明                 | 输出                           | 增强点                                   |
| --------------------------- | -------------------- | ------------------------------ | ---------------------------------------- |
| brainstorming               | 需求头脑风暴         | `specs/<date+feature>/spec.md` | +可视化伴侣、设计自检、用户审查 Gate     |
| writing-plans               | 分层拆解 task        | `specs/<date+feature>/plan.md` | +模型选择、类型一致性检查、执行选项      |
| git-worktree                | 创建隔离分支         | feature 分支                   | +测试基线验证                            |
| subagent-driven-development | Subagent 派发 + 审查 | 源码 + 测试报告                | +独立模板文件、4种状态处理、审查模式选项 |
| index-update                | 工程索引同步         | ENGINEERING-INDEX.md           | loom 新增                                |

### 辅助 Skills（loom 新增）

| Skill        | 说明                                    |
| ------------ | --------------------------------------- |
| init-project | 项目初始化（扫描 + 生成宪章/结构）      |
| using-loom   | loom 框架使用指南（含常见问题、流程图） |

### 通用 Skills（融合 superpowers 优点）

| Skill                          | 说明              | 融合点                                            |
| ------------------------------ | ----------------- | ------------------------------------------------- |
| test-driven-development        | TDD 测试驱动开发  | +流程图、好/坏示例、常见借口表、验证清单          |
| systematic-debugging           | 系统化调试        | +4阶段流程图、条件等待、纵深防御                  |
| verification-before-completion | 完成前验证        | +Spec覆盖检查、类型一致性、流程图                 |
| using-git-worktrees            | Git worktree 管理 | +测试基线验证、流程图                             |
| finishing-a-development-branch | 分支完成流程      | +选项展示（Merge/PR/Keep/Discard）、流程图        |
| requesting-code-review         | 请求代码审查      | +预审查清单、审查模板、流程图                     |
| receiving-code-review          | 接收代码审查      | +响应模板、流程图                                 |
| dispatching-parallel-agents    | 并行 agent 派发   | +模型选择、并发工作流图、流程图                   |
| writing-skills                 | 编写自定义 skills | +方法论深度、流程图、REFERENCE 目录               |
| executing-plans                | 执行计划          | **已删除**，已被 subagent-driven-development 替代 |

## 流水线状态横幅

每个阶段输出状态横幅：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 pipeline [■■■□□] Step 3/5 — git-worktree
 功能:    feature-name
 status:  ▶ 开始执行
 下一步:  → Step 4: subagent-dev
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 完成工作后更新

代码变更后同步更新：

1. `ENGINEERING-INDEX.md` — 新增/删除了模块、路由、控制器、服务
2. `.loom/memory/MEMORY.md` — 踩坑、用户偏好、变更要点
3. `LOOM.md` — 引入了新的约定或命令

## 记忆

持久化记录在 `.loom/memory/MEMORY.md`，新会话时先读此文件。
