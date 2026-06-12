---
name: loom-requesting-code-review
description: >
  Prepare a code review request with change summary, self-test results, and focus areas for reviewers.
---

# 请求代码审查

## 触发条件

- verification-before-completion 通过后，需要人工代码审查时
- 用户主动要求发起代码审查
- 分支开发完成、准备合并前

## 完成条件与下一步

- 审查请求已生成并发送
- 下一步：等待审查反馈 → 使用 `loom-receiving-code-review` 处理反馈

## 预审查清单

在请求审查前，确保：

- [ ] 所有变更已提交
- [ ] 编译通过（BUILD_CMD）
- [ ] 静态分析通过（VET_CMD）
- [ ] 所有测试通过（TEST_CMD）
- [ ] 代码符合项目编码红线
- [ ] codegraph 状态已确认（可用时直接查询 `.codegraph/`，否则注明图查询已跳过）

## 执行流程

### Step1：准备审查材料

1. 确认所有变更已完成
2. 运行验证确保代码质量（读取宪章中的 BUILD_CMD、VET_CMD、TEST_CMD 并执行）

### Step2：整理变更摘要

```bash
git diff --stat
git log --oneline -10
```

### Step3：生成审查请求

```markdown
# 代码审查请求

**功能：** <feature-name>
**分支：** feature/<date>-<feature-name>

## 变更统计

<git diff --stat 输出>

## 主要变更

1. <变更说明 1>
2. <变更说明 2>

## 重点关注

1. 架构设计：xxx
2. 安全性：xxx
3. 性能：xxx

## 自测情况

- [x] 编译通过（BUILD_CMD）
- [x] 静态分析通过（VET_CMD）
- [x] 测试通过（TEST_CMD）
- [x] 代码符合编码红线
- [x] codegraph 已同步，或已注明索引查询跳过

## 变更详情

| 文件          | 变更类型 | 说明            |
| ------------- | -------- | --------------- |
| path/to/file1 | 新增     | XxxService 实现 |
| path/to/file2 | 修改     | 新增方法        |

## 审查重点

- [ ] 架构合规性
- [ ] 代码质量
- [ ] 安全性检查
- [ ] 性能影响
```

## 约束

- 审查请求必须包含完整的变更摘要
- 必须标注重点关注项
- 必须提供自测情况
