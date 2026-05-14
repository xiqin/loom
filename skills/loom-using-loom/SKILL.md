---
name: loom-using-loom
description: >
  loom 框架使用指南。当用户首次使用 loom 或询问如何使用时触发。
  Use when: introducing the loom framework and its capabilities.
  Trigger keywords: loom 使用指南, loom 入门, 如何使用 loom
---

# Using loom — AI 工程化框架

loom 是一个 AI 工程化框架，提供 6 步流水线、项目宪章、5 维审查、进度追踪等能力。

## 核心流水线

```
brainstorming → writing-plans → git-worktree → subagent-dev → verification → index-update
```

### 流水线阶段

| Step | 阶段                        | 说明                                     | 输出                           |
| ---- | --------------------------- | ---------------------------------------- | ------------------------------ |
| 1    | brainstorming               | 需求头脑风暴，探索 2-3 种实现方案        | `specs/<date+feature>/spec.md` |
| 2    | writing-plans               | 按分层拆解 task                          | `specs/<date+feature>/plan.md` |
| 3    | git-worktree                | 创建隔离分支                             | feature 分支                   |
| 4    | subagent-driven-development | Subagent 隔离派发 + 双审查               | 源码 + 测试报告                |
| 5    | verification                | 完成前验证，Spec覆盖/类型一致性/编译测试 | 验证报告                       |
| 6    | index-update                | 工程索引同步                             | 知识图谱 或 ENGINEERING-INDEX.md |

### 阶段串联规则

- brainstorming 完成 → 等待用户确认 → writing-plans
- writing-plans 完成 → 等待用户确认 → git-worktree
- git-worktree 完成 → 触发 subagent-dev
- subagent-dev 完成 → 触发 verification
- verification 通过 → 触发 index-update
- verification 未通过 → 修复后重新验证
- index-update 完成 → 通知可以提交

<!-- loom:generate:rule:no-skip-step -->
**严令禁止跳步**

严令禁止跳过任何步骤。每个步骤完成后必须显式触发下一步，不可自行终止。
<!-- /loom:generate:rule:no-skip-step -->

## Skills 系统

### Skills 清单

<!-- loom:generate:skills-catalog -->
所有 skills 通过 `/` 命令或 Skill 工具调用。详见 `.loom/skills/` 目录（完整定义）

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
<!-- /loom:generate:skills-catalog -->

### Skills 触发方式

**自动触发：**

- 当满足触发条件时，skill 会自动激活
- 例如：用户说"我想做 XX 功能" → 触发 brainstorming

**手动调用：**

- 使用 Skill 工具：`Skill("loom-brainstorming")`
- 使用斜杠命令：`/loom-brainstorm`、`/loom-write-plan`

## 项目规则

项目规则存储在 `.loom/memory/constitution.md`（宪章）和 `.loom/rules/project-structure.md`（工程约束）中。

首次使用请运行 `/loom-init-project` 自动生成这些文件。

## 进度追踪

每个功能开发必须维护 `specs/<date+feature>/progress.md`，可视化流水线状态。

## 状态横幅

每个阶段输出状态横幅（格式参见 writing-skills SKILL.md 状态横幅规范）：

- 开始：`▶ pipeline [■□□□□□] Step N/6 — <阶段名> | 功能: <名> | status: 开始`
- 完成：`✅ pipeline [■■□□□□] Step N/6 — <阶段名> | 完成 | → Step N+1: <下阶段>`

## 5 维审查

<!-- loom:generate:review-summary -->
### 5 维审查

| 维度 | 关键检查项 |
|------|----------|
| 架构合规 | 是否遵循项目架构分层（从 project-structure.md 读取）、是否存在跨层调用 |
| 代码质量 | 是否使用了项目禁止的调试函数、SQL 是否参数化（防注入） |
| 安全风险 | SQL 注入检查、认证/授权是否正确 |
| 性能隐患 | N+1 查询检查、分页查询是否使用框架分页组件 |
| 规范一致性 | 命名是否符合项目规范、响应格式是否统一 |
<!-- /loom:generate:review-summary -->

## 常见问题

### Q: 可以跳过某个步骤吗？

A: **不可以。** 流水线每个步骤都有明确目的，跳过会导致质量问题。

### Q: 如何知道当前在哪个阶段？

A: 查看状态横幅，或读取 `specs/<date+feature>/progress.md`。

### Q: subagent 失败了怎么办？

A: 查看失败状态（BLOCKED/NEEDS_CONTEXT），根据情况提供更多信息、更换模型或分解任务。

## 流程图

```
brainstorming → writing-plans → git-worktree → subagent-dev → verification → index-update → 完成
```
