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

## 熔断配置

从 `.loom/workflow.yaml` 的 `defaults` 读取全局配置，step 级别配置可覆盖全局值：

```yaml
# 全局默认（workflow.yaml defaults 区块）
max_retries: 3          # 单个 task 的最大修复重试次数
timeout_minutes: 30     # 单个 subagent 的超时时间（分钟）
```

**每个 task 独立计算重试次数**，不跨 task 累计。

## 执行流程

1. 读取 `plan.md` Task 概览和 `tasks/TN.md` 详细内容，创建任务追踪列表。
2. 读取 `.loom/workflow.yaml` 的 `defaults`，获取 `max_retries` 和 `timeout_minutes`；当前 step 有 `config` 字段时以 step 级别为准。
3. 读取 `.loom/contexts/subagent-context.md`，必要时读取 `spec.md` 相关章节。
4. 对每个 task，执行以下循环（`retry_count` 初始为 0）：

   ```
   LOOP:
     派发 implementer（首次实现 或 修复模式）
     
     若 subagent 超时（> timeout_minutes）：
       → 更新 progress.md 为 ❌ 失败，备注"subagent 超时"
       → 上报用户：任务名、已耗时、建议（拆分 task 或手动介入）
       → 停止当前 task，等待用户指示，禁止自动重试超时任务
     
     处理状态：
       DONE / DONE_WITH_CONCERNS → 继续派发 reviewer
       NEEDS_CONTEXT             → 补充上下文后重新派发，不计入 retry_count
       BLOCKED                   → 上报用户，等待解除后继续，不计入 retry_count
     
     派发 combined reviewer
     
     若 reviewer PASS：
       → 进入下一个 task
     
     若 reviewer FAIL：
       retry_count += 1
       若 retry_count > max_retries：
         → 触发熔断（见"熔断处理"）
       否则：
         → 提取修复指令，派发 implementer（修复模式），回到 LOOP 顶部
   ```

5. 所有 task PASS 后，派发 test-reporter。
6. test-reporter 编写持久化集成测试、运行回归测试、对照 spec 验证并输出 `test-report.md`。
7. test-reporter FAIL 时提取修复指令，派发 implementer（修复模式），再重跑 test-reporter。
   - test-reporter 的修复重试同样受 `max_retries` 限制，超限触发熔断。

## 熔断处理

触发条件：单个 task 的 `retry_count > max_retries`，或 subagent 超时。

熔断后**必须执行以下步骤，禁止自动继续**：

1. 更新 `specs/<date+feature>/progress.md`：
   ```
   ❌ 熔断 | HH:mm | TN <task名> | 原因：已重试 N 次 / 超时
   ```
2. 输出熔断报告给用户，包含：
   - 熔断的 task 编号和名称
   - 最后一次 reviewer 的阻断问题列表（或超时信息）
   - 已完成的 task 列表
   - 三个处置选项供用户选择：
     ```
     [A] 拆分此 task，重新规划后继续
     [B] 我来手动修复，修复完告诉我继续
     [C] 跳过此 task，继续后续 task（需确认影响）
     ```
3. 等待用户明确选择，禁止自动推进。

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
- 禁止在熔断后自动继续，必须等待用户指示。
- 禁止对超时任务自动重试。

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

## 完成条件

全部 task、reviewer、test-reporter 通过。