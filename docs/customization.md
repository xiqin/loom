---
title: 自定义指南
description: loom 框架多级自定义说明
---

# 自定义指南

## 概述

loom 框架支持多级自定义：

1. **项目级自定义**：在 `.loom/` 目录中覆盖默认配置
2. **Skill 级自定义**：创建项目专属 skill
3. **模板自定义**：修改生成模板

## 项目级自定义

### 宪章自定义

编辑 `.loom/rules/constitution.md`：

```markdown
# 项目宪章

## 核心原则

1. **分层架构**：...
2. **DI**：...
3. **配置驱动**：...
4. **统一错误处理**：...
5. **代码生成**：...

## 编码红线

1. 禁止在 Controller 中写业务逻辑
2. 禁止使用 fmt.Println（必须用 Zap）
3. 禁止硬编码配置值
   ...

## 项目特有的约束

- 自定义约束 1
- 自定义约束 2
```

### 工程结构自定义

编辑 `.loom/rules/project-structure.md`：

添加项目特有的目录结构、编码规范、开发流程。

### 审查维度自定义

创建 `.loom/rules/review-dimensions.md`：

```markdown
# 自定义审查维度

在默认 5 维基础上追加：6. 业务逻辑正确性 — BLOCKER — 验证业务规则 7. API 兼容性 — WARNING — 检查接口变更
```

## Skill 级自定义

### 覆盖默认 Skill

在 `.loom/skills/` 中创建同名 skill：

```
.loom/skills/
  writing-plans/
    SKILL.md        # 覆盖 loom 默认的 writing-plans
```

### 创建项目专属 Skill

```
.loom/skills/
  my-custom-skill/
    SKILL.md
    REFERENCE/
      custom-reference.md
```

### Skill 格式

```markdown
---
name: my-custom-skill
description: >
  自定义 skill 描述。
---

# Skill 标题

## 触发条件

...

## 执行流程

...

## 完成条件与下一步

...
```

## 模板自定义

### 修改宪章模板

编辑 loom 框架的 `templates/constitution.md`。

可用变量：

- `{{PROJECT_NAME}}` — 项目名称
- `{{ARCH_PRINCIPLE}}` — 架构原则
- `{{CODING_REDLINES}}` — 编码红线
- ...

### 修改工程结构模板

编辑 loom 框架的 `templates/project-structure.md`。

## 流水线自定义

### 修改流水线步骤

如果项目需要自定义流水线（如添加额外步骤），编辑 `.loom/rules/constitution.md`：

```markdown
## 开发流程
```

brainstorming → writing-plans → git-worktree → subagent-dev → 代码扫描 → index-update

```

### 添加流水线步骤

在 `skills/` 中创建新 skill，并在宪章中添加步骤说明。

## 进度追踪自定义

修改 `config/pipeline.schema.json` 中的 `progressFileFormat` 定义，或在项目宪章中指定自定义格式。

## 注意事项

- 自定义文件放在 `.loom/` 目录中，优先级高于 loom 默认
- 修改 loom 框架模板会影响所有使用 loom 的项目
- 建议使用项目级自定义而非修改框架本身

## 完成前自检清单

- [ ] 自定义文件放在了 `.loom/` 目录而非 loom 框架目录？
- [ ] 覆盖的 skill 保持了与原 skill 相同的输出格式？
- [ ] 修改模板后更新了对应文档？
- [ ] 添加了项目级 hooks 后验证了执行权限？
- [ ] 变更记录已在 `.loom/memory/MEMORY.md` 中更新？
```
