---
name: loom-brainstorming
description: >
  需求头脑风暴。当用户提出需求、功能描述、PRD 时触发，探索 2-3 种实现方案及 trade-off。
  Use when: starting any feature development to explore design options.
  Trigger keywords: 头脑风暴、brainstorm、设计方案、怎么做、怎么实现
---

# 需求头脑风暴

## 触发条件

- 用户提出新需求、功能描述或 PRD。
- 用户询问设计方案、实现路径或技术 trade-off。

## 执行流程

### Step 1：理解需求

1. 读取 `.loom/rules/constitution.md` 和 `.loom/rules/project-structure.md`。
2. 修改类需求先分析现有实现和影响范围。
3. 明确边界：做什么、不做什么。

### Step 2：可视化伴侣（可选）

如果预计涉及模型、布局、架构图等可视化内容，单独询问用户是否使用浏览器展示。详细流程见 `references/visual-companion.md`。

### Step 3：探索 2-3 种方案

每个方案包含：方案名称、架构思路、数据流、trade-off、实现步骤。以推荐方案开头并解释原因；如果范围跨多个独立子系统，先建议拆分。

### Step 4：集中澄清

把待决议项集中展示给用户，优先给多选项，不逐个零散追问。

```markdown
## 待决议项

| #   | 问题           | 选项                              |
| --- | -------------- | --------------------------------- |
| 1   | 数据存储方式？ | A: 关系型数据库 / B: 文档型数据库 |
```

### Step 5：输出 spec.md

用户确认方案后，写入 `specs/<date+feature>/spec.md`。文件夹命名格式：`<YYYY-MM-DD>+<功能名>`，如 `2026-04-26+user-management`。

使用 `assets/spec-template.md` 作为结构模板，并按项目类型删去不适用章节。

### Step 6：Spec 自审

- 占位符：不得残留 `TBD`、`TODO` 或未完成段落。
- 一致性：架构、功能、接口、数据模型不能互相矛盾。
- 范围：聚焦单个实现计划；过大时拆分。
- 歧义：有两种解释时选定一种并写清楚。

### Step 7：用户审查 Gate

自审通过后让用户审查 spec。用户要求修改时，修复并重新自审；只有用户批准后才继续 writing-plans。

## 约束

- 每个方案必须有 trade-off。
- 禁止模糊描述，如"大概"、"可能"、"差不多"。
- 数值必须有单位，如"2 秒内"、"100 条/页"。
- 接口/API 设计必须遵循项目约定。
- YAGNI：删除不必要功能。

## progress.md 更新

<!-- loom:generate:progress:brainstorming -->

**progress.md 更新（由 `config/pipeline.schema.json` 生成）**

- 阶段：Step 1 / `brainstorming` / `loom-brainstorming`。
- 开始时创建 `specs/<date+feature>/progress.md`：Step 1 设为 `▶ 进行中`，后续步骤设为 `⏳ 等待`。
- 完成时：Step 1 设为 `✅ 完成`，完成时间填当前 HH:mm，并把本 skill 调用记录结果更新为 `✅ 完成`。
- 失败时：Step 1 设为 `❌ 失败`，完成时间填失败时 HH:mm，备注写明阻断原因。
- 备注列按阶段产物填写：`specs/<date+feature>/spec.md`、`specs/<date+feature>/progress.md`；执行阶段可记录 task 进度，worktree 阶段可记录分支名。
- 时间必须填实际 `HH:mm` 数值，如 `14:30`；禁止填字面量 `HH:mm`。
<!-- /loom:generate:progress:brainstorming -->

## 完成条件与下一步

`spec.md` 保存、自审、progress 更新完成后，等待用户确认方案；用户确认后遵循 `.loom/workflow.yaml` 继续下一步。
