---
name: loom-index-update
description: >
  Synchronize engineering index, memory file, and entry docs with code after verification passes.
---

# 索引更新 Skill

## 触发条件

- 功能测试和 completion verification 通过后自动触发。
- 用户手动要求更新索引、同步索引或更新文档。

## 前置条件

1. 代码变更已完成。
2. `loom-verification-before-completion` 已通过，或用户明确要求只更新索引。

## 执行流程

### Step 1：检测变更范围和 graphify

1. 运行 `git diff --name-only HEAD` 确认变更文件。
2. 按 `references/update-checklist.md` 判断需要更新哪些索引。
3. 检测 graphify 是否可用；可用则判断是增量更新还是首次构建。

### Step 2：更新工程结构索引

路径 A：graphify 可用时，调用 graphify skill 完整执行 `/graphify . --update` 或 `/graphify .`，以知识图谱替代手动维护 ENGINEERING-INDEX.md。

路径 B：graphify 不可用时，按项目实际分层手动更新 `.loom/index/engineering-index.md`。更新顺序从底层到上层：数据源 → 模型 → 业务逻辑 → 接口/UI → 路由/配置 → 调用链。

### Step 3：更新 MEMORY.md

- 新踩坑：添加到踩坑记录。
- 新偏好：添加到用户偏好。
- 重大架构或技术栈变化：更新项目状态。

### Step 4：必要时更新入口文件

只有引入新约定、新命令、入口程序变化或开发流程调整时，才更新入口文件。一般性代码变更不更新。

### Step 5：输出报告

报告模板见：

- `assets/report-graphify-template.md`
- `assets/report-manual-template.md`

## 约束

- 只更新索引和记忆文件，不修改业务代码。
- 索引内容必须与实际代码一致。
- 新增表名、路由路径、方法签名必须与源码完全一致。
- graphify 与 ENGINEERING-INDEX.md 互斥：graphify 可用时使用知识图谱，否则回退手动索引。

## 完成条件与下一步

索引更新完成后输出报告，确认所有索引文件已同步；索引未更新则禁止提交。
