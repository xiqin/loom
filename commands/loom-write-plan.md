# /loom-write-plan

拆解实现计划。

## 用法

```
/loom-write-plan [feature-name]
```

## 功能

加载 `skills/writing-plans/SKILL.md`，拆解实现计划：

1. 读取 `specs/<date+feature>/spec.md`
2. 按项目架构分层拆解 task
3. 输出 `specs/<date+feature>/plan.md`
4. 等待用户确认 plan

## 前置条件

- `spec.md` 必须存在（由 brainstorming 生成）

## 示例

```
/loom-write-plan passport-list
```
