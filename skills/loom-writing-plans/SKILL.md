---
name: loom-writing-plans
description: >
  Break a confirmed spec into ordered, independently-verifiable task files with dependency analysis.
---

# 实现计划拆解

## 触发条件

- `specs/<date+feature>/spec.md` 已存在并经用户确认。
- 需要把 spec 拆为可独立验证的 task 文件。

## 输出

- `specs/<date+feature>/plan.md`：摘要 + Task 概览。
- `specs/<date+feature>/tasks/T1.md`、`T2.md`...：每个 task 一个独立文件。

使用 `assets/plan-template.md` 和 `assets/task-template.md` 作为输出模板。

## 执行流程

1. 读取 `spec.md`，提取功能点、接口、数据模型和边界场景。
2. 读取 `.loom/rules/constitution.md`、`.loom/rules/project-structure.md`；如存在，读取 `.loom/contexts/subagent-context.md`。
3. 先规划文件结构：创建/修改哪些文件、每个文件职责、哪些文件一起变化。
4. 按项目实际分层和依赖顺序拆 task：数据/模型 → 业务逻辑 → 接口/UI → 路由/配置 → 集成。
5. 写 `plan.md` 概览，再为每个 task 写完整 `tasks/TN.md`。
6. 自检并运行自动校验。

如果 spec 涵盖多个独立子系统，建议拆成多个计划；每个计划都应能产出可工作、可测试的独立软件。

## Task 粒度

- 每个 task 是一个可独立验证的交付物。
- 每个 task 包含层级、复杂度、依赖、涉及文件、TDD 步骤、测试说明。
- 依赖必须无循环；有循环依赖时拆开或合并。
- 后续 task 使用的类型、方法签名和属性名必须与前序 task 匹配。

## 自动校验

完成 `plan.md` 和 `tasks/Tn.md` 后运行：

```bash
node <skill-dir>/scripts/validate-plan.mjs --spec-dir specs/<date+feature>
```

脚本失败时，先修复计划文件，再进入用户确认 gate。

## 检查清单

<!-- loom:generate:rule:placeholder-scan-ban -->
**占位符扫描禁止**

禁止使用以下占位符，发现即视为未完成：TBD、TODO、implement later、fill in details、Similar to Task N、"add appropriate error handling"
<!-- /loom:generate:rule:placeholder-scan-ban -->

- [ ] plan.md 包含摘要和 Task 概览表。
- [ ] 每个 task 文件包含完整字段和可执行步骤。
- [ ] task 可独立编译或验证。
- [ ] 分层顺序来自 project-structure.md。
- [ ] 遵守 constitution.md 编码红线。

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

`plan.md`、所有 `tasks/TN.md` 和自动校验完成后，等待用户确认 plan；用户确认后继续 git-worktree。
