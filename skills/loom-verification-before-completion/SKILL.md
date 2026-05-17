---
name: loom-verification-before-completion
description: >
  完成前验证。在宣布任务完成前，执行完整性检查确保所有工作已完成。
  Use when: before declaring a task or feature complete.
  Trigger keywords: 完成验证, 验证检查, 完成前检查
---

# 完成前验证

## 状态输出

执行开始时：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
pipeline [■■■■■□] Step 5/6 — 完成前验证 (verification)
skill: verification-before-completion
status: ▶ 开始执行
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

执行结束时：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
pipeline [■■■■■■] Step 5/6 — 完成前验证 (verification)
status: ✅ 完成
下一步: → Step 6: index-update
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 铁律

1. **没有证据就不能声称通过。** 违反字面就是违反精神。
2. **"没有新鲜验证证据就不许声称完成。"** 如果当前消息中没有执行过验证命令，就不许断言某项通过。
3. **读取前置产出的验证证据也算验证证据。** test-report.md、reviewer 判定报告构成有效证据，不必重新执行已有结果的命令。

## 门禁函数

做出任何状态声明前：

1. **识别**：哪个命令或已存报告能证明你的声明
2. **运行或读取**：未执行过的命令须完整执行；已有报告的读取并引用
3. **验证**：输出是否真正确认了你的断言
4. **然后**才做出声明并附带证据

跳过任何一步 = 不诚实。

## Red Flag

以下措辞意味着未验证就声称：

- "应该通过了" / "probably passes"
- "似乎没问题" / "seems fine"
- "我觉得可以" / "I think it works"
- 表达满意在验证之前
- 信任 agent 报告而无独立确认

**发现Red Flag？** 立即停止，运行实际命令或读取实际报告，然后才声称。

## 执行流程

### Step 1：前置产出核验

- [ ] 读取 `specs/<date+feature>/test-report.md`，确认包含：
  - "测试概览"部分（含 PASS/FAIL 结论）
  - "接口验证详情"（逐接口 PASS/FAIL）
  - "编译和静态分析"（BUILD_CMD + VET_CMD 结果）
  - 结论为 PASS（全部 PASS 或仅有 WARN）
- [ ] 读取 combined-reviewer 报告，确认最终判定为"通过"
- [ ] **缺失处理**：test-report.md 缺失或结论为 FAIL → 标记为阻断问题，建议重新运行 test-reporter；reviewer 报告缺失 → 标记为阻断问题

### Step 2：编译验证

- [ ] 读取 `.loom/rules/constitution.md` 中的 BUILD_CMD 并执行
- [ ] 读取 `.loom/rules/constitution.md` 中的 VET_CMD 并执行
- [ ] **不运行 TEST_CMD**（已由 test-reporter 执行并记录在 test-report.md 中）

### Step 3：占位符扫描

- [ ] 搜索 "TBD"、"TODO"、"implement later"、"fill in details"
- [ ] 发现时标记为阻断问题

### Step 4：类型一致性检查

- [ ] 后续 task 中使用的类型、方法签名和属性名与早期 task 定义匹配
- [ ] 函数命名一致（如 clearLayers vs clearFullLayers）

### Step 5：最终一致性核验

- [ ] 读取 spec.md 中的功能清单
- [ ] 逐项确认 test-report.md 中有对应接口的验证结果
- [ ] 如有未覆盖的功能点，标记为阻断问题

### Step 6：输出验证报告

保存到 `specs/<date+feature>/verify-report.md`。

```markdown
## 完成前验证报告

**功能：** xxx
**验证时间：** YYYY-MM-DD HH:mm

### 检查结果

| 检查项         | 状态 | 说明                        |
| -------------- | ---- | --------------------------- |
| 前置产出核验   | ✅   | test-report + reviewer 通过 |
| BUILD_CMD      | ✅   | 编译通过                    |
| VET_CMD        | ✅   | 无警告                      |
| 占位符扫描     | ✅   | 无占位符                    |
| 类型一致性     | ✅   | 类型匹配                    |
| 最终一致性核验 | ✅   | spec 功能全覆盖             |

**结论：** ✅ 可以提交
```

验证未通过时：

```markdown
**结论：** ❌ 需要修复

## 修复指令

### 修复项 1

- **问题**：<具体问题描述>
- **文件**：<文件路径>
- **位置**：<函数名/行号/区域>
- **严重度**：阻断
- **修复方向**：<具体修复方向>
```

## 约束

- 所有检查必须通过才能提交
- 已有证据的项（test-report.md PASS、reviewer 判定通过）不须重做
- 缺失证据的项必须执行或补做

## progress.md 更新

**开始执行时**：更新 `specs/<date+feature>/progress.md`，将 Step 5 状态设为 `▶ 进行中`，开始时间填写当前时间（HH:mm 格式）；在 Skill 调用记录中追加一行。

**执行完成时**：将 Step 5 状态更新为 `✅ 完成`，完成时间填写当前时间；在 Skill 调用记录中更新对应行。

**验证失败时**：将 Step 5 状态更新为 `❌ 失败`，完成时间填写失败时的时间，备注列填写失败原因；在 Skill 调用记录中更新对应行。

**关键：时间必须填入实际的 HH:mm 数值，禁止填入字面量 "HH:mm"。**

## 完成条件与下一步

**验证通过后：** 更新 progress.md，遵循 `.loom/workflow.yaml` 继续下一步。

**验证未通过：** 更新 progress.md 标记失败，输出修复指令后回到 executing 阶段。**禁止全量重新执行 Step 4**，只派发 implementer（修复模式）修复 BLOCKER。

编排器提取修复指令，只传递修复指令 + subagent-context.md，不重新传递完整 task 上下文和 spec 全文。

## 流程图

```
前置产出核验 → 编译验证 → 占位符扫描 → 类型一致性检查
→ 最终一致性核验 → 输出报告
    ├→ 全部通过 → 完成
    └→ 有阻断问题 → 输出修复指令
        → 派发 implementer(修复模式)
        → 增量重验（只重验失败的项）
```
