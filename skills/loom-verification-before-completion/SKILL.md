---
name: loom-verification-before-completion
description: >
  完成前验证。在宣布任务完成前，执行完整性检查确保所有工作已完成。
  Use when: before declaring a task or feature complete.
  Trigger keywords: 完成验证, 验证检查, 完成前检查
---

# 完成前验证

## 铁律

1. 没有证据就不能声称通过。
2. 当前消息没有新鲜验证证据，就不许声称完成。
3. 已有 `test-report.md`、reviewer 判定等前置报告也算证据，但必须读取并引用。

## 门禁函数

做状态声明前：识别证据 → 运行命令或读取报告 → 验证输出确实支持断言 → 再声明。

## 自动校验

进入人工判断前运行：

```bash
node <skill-dir>/scripts/verify-artifacts.mjs --spec-dir specs/<date+feature>
```

脚本通过只代表产物齐全且没有明显机械性缺陷；脚本失败时，先修复或补齐证据。

## 执行流程

1. 前置产出核验：读取 `test-report.md` 和 combined-reviewer 报告，确认最终通过。
2. 编译验证：读取 `.loom/rules/constitution.md` 中的 BUILD_CMD、VET_CMD 并执行；TEST_CMD 已由 test-reporter 执行时不重复。
3. 占位符扫描：搜索 `TBD`、`TODO`、`implement later`、`fill in details`。
4. 类型一致性检查：后续 task 使用的类型、方法签名和属性名与前序定义一致。
5. 最终一致性核验：spec 功能清单在 test-report 中有对应验证。
6. 输出 `specs/<date+feature>/verify-report.md`。

报告模板见：

- `assets/verify-report-template.md`
- `assets/fix-instructions-template.md`

## Red Flag

以下措辞意味着未验证就声称：`应该通过了`、`probably passes`、`似乎没问题`、`seems fine`、`我觉得可以`。发现后立即停止，补证据再声明。

## 约束

- 所有检查通过才能提交。
- 已有证据不须重做，但必须读取确认。
- 缺失证据的项必须执行或补做。
- 验证失败时输出结构化修复指令，回到 executing 阶段，只派发 implementer 修复模式。
<!-- loom:generate:rule:build-vet-test-cmd -->
**构建/检查/测试命令**

读取 `.loom/rules/constitution.md` 中的 BUILD_CMD/VET_CMD/TEST_CMD 并执行验证。
<!-- /loom:generate:rule:build-vet-test-cmd -->

## progress.md 更新

<!-- loom:generate:progress:verification -->
**progress.md 更新（由 `config/pipeline.schema.json` 生成）**
- 阶段：Step 5 / `verification` / `loom-verification-before-completion`。
- 开始时更新 `specs/<date+feature>/progress.md`：Step 5 设为 `▶ 进行中`，开始时间填当前 HH:mm，并追加 Skill 调用记录。
- 完成时：Step 5 设为 `✅ 完成`，完成时间填当前 HH:mm，并把本 skill 调用记录结果更新为 `✅ 完成`。
- 失败时：Step 5 设为 `❌ 失败`，完成时间填失败时 HH:mm，备注写明阻断原因。
- 备注列按阶段产物填写：`验证报告`、`specs/<date+feature>/verify-report.md`、`specs/<date+feature>/progress.md`；执行阶段可记录 task 进度，worktree 阶段可记录分支名。
- 时间必须填实际 `HH:mm` 数值，如 `14:30`；禁止填字面量 `HH:mm`。
<!-- /loom:generate:progress:verification -->

## 完成条件与下一步

验证通过后更新 progress 并进入 index-update；验证失败时标记失败，输出修复指令，禁止全量重跑 Step 4。
