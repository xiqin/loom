---
name: loom-brainstorming
description: >
  Explore 2-3 implementation options with trade-offs when the user describes a new feature or requirement.
---

# 需求头脑风暴

## 触发条件

- 用户提出新需求、功能描述或 PRD。
- 用户询问设计方案、实现路径或技术 trade-off。

## 执行流程

### Step 1：理解需求

1. 若存在 `.loom/rules/product.md`，先读取，作为产品定位、目标用户和原型约束的视角依据（PM / pm-prototype 流水线）。
2. 若存在 `.loom/rules/constitution.md`，读取其中架构、目录和编码约束。
3. 修改类需求先分析现有实现和影响范围。
4. 明确边界：做什么、不做什么。

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

## 完成条件

`spec.md` 保存、自审完成。
