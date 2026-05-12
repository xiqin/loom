# loom — Weave Specs into Execution

AI 工程化框架。从需求描述出发，经过头脑风暴、计划拆解、隔离开发、代码审查，最终交付。

## 宪法（最高优先级）

- **项目章程**：`.loom/memory/constitution.md` — 核心原则，开发前必读
- **工程约束**：`.loom/rules/project-structure.md` — 目录结构、编码红线

**所有开发活动必须遵守以上两份文件。与之冲突以这两份文件为准。**

## 开发流程

```
brainstorming → writing-plans → git-worktree → subagent-dev → index-update
```

{{SKILLS_SECTION}}

## 工程索引

`ENGINEERING-INDEX.md` 是项目索引，包含路由表、控制器/服务/模型层的方法签名、依赖关系和调用链。

**回答任何关于项目结构、路由、模块、方法签名、依赖关系的问题前，必须先读此索引。索引已覆盖签名级信息，绝大多数问题无需回退读源码。只有在需要修改具体实现逻辑时才读源码文件。**

## 完成工作后更新

代码变更后同步更新：

1. `ENGINEERING-INDEX.md` — 新增/删除了模块、路由、控制器、服务
2. `.loom/memory/MEMORY.md` — 踩坑、用户偏好、变更要点
3. `{{ENTRY_FILE}}` — 引入了新的约定或命令

## 记忆

持久化记录在 `.loom/memory/MEMORY.md`，新会话时先读此文件。
