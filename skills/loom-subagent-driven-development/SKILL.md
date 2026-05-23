---
name: loom-subagent-driven-development
description: >
  Execute plan tasks via isolated subagents with reviewer checkpoints. Handles DONE/BLOCKED/NEEDS_CONTEXT states.
---

# Subagent 编码执行

## 触发条件

- `specs/<date+feature>/plan.md` 和 `tasks/` 已存在。
- git worktree 已创建。
- 用户确认 plan 后进入执行阶段。

## 核心机制

每个 task 派发一个 fresh subagent；实现后由 reviewer 做合并审查（spec 合规 + 代码质量）。审查、测试或验证失败时，提取修复指令，派发 implementer 的修复模式，只传递修复指令 + `.loom/contexts/subagent-context.md`。

详细状态处理、执行循环和红线见 `references/execution-details.md`。派发前必须读取相关 prompt 模板：

- `implementer-prompt.md`
- `combined-reviewer-prompt.md`
- `test-reporter-prompt.md`

## 执行流程

1. 读取 `plan.md` Task 概览和 `tasks/TN.md` 详细内容，创建任务追踪列表。
2. 读取 `.loom/contexts/subagent-context.md`，必要时读取 `spec.md` 相关章节。
3. 对每个 task：
   - 派发 implementer（首次实现模式）。
   - 处理 DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED。
   - 派发 combined reviewer。
   - reviewer FAIL 时提取修复指令，派发 implementer（修复模式），循环到 PASS。
4. 所有 task PASS 后，派发 test-reporter。
5. test-reporter 编写持久化集成测试、运行回归测试、对照 spec 验证并输出 `test-report.md`。
6. test-reporter FAIL 时提取修复指令，派发 implementer（修复模式），再重跑 test-reporter。

## 上下文规则

首次实现模式传入：

- `specs/<date+feature>/spec.md` 相关章节
- `specs/<date+feature>/tasks/TN.md`
- `.loom/contexts/subagent-context.md`

修复模式只传入：

- reviewer / test-reporter / verification 输出中的结构化修复指令
- `.loom/contexts/subagent-context.md`

不要在修复模式重新传递完整 task 和 spec 全文。

## 关键红线

- 禁止在 spec 未批准、plan 未确认前开始实现。
- 禁止跳过 reviewer 审查或 test-reporter。
- 禁止有未修复 BLOCKER 时进入下一个 task。
- 禁止默认并行派发；需要并行时使用 `loom-dispatching-parallel-agents`。
- 禁止把测试文件作为临时验证后删除。

## 模型选择策略

<!-- loom:generate:model-selection -->
## 模型选择策略

使用最强大的模型来处理每个角色，以节省成本并提高效率：

**机械实现任务**（隔离函数、清晰规范、1-2 个文件）：使用快速、便宜的模型。当计划明确时，大多数实现任务都是机械的

**集成和判断任务**（多文件协调、模式匹配、调试）：使用标准模型

**架构、设计和审查任务**：使用可用的最强模型

**任务复杂度信号：**

- 触及 1-2 个文件且有完整规范 → 便宜模型
- 触及多个文件且有集成问题 → 标准模型
- 需要设计判断或广泛的代码库理解 → 最强模型
<!-- /loom:generate:model-selection -->

## 完成条件与下一步

全部 task、reviewer、test-reporter 通过后，按 AGENTS.md 流水线规则更新进度并进入 verification。
