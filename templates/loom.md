> 本文件由 loom init-project 自动生成。修改请编辑 `.loom/` 源文件。重新运行 `/loom-init-project` 将重新分发。

# loom — Weave Specs into Execution

AI 工程化框架。从需求描述出发，经过头脑风暴、计划拆解、隔离开发、代码审查、完成前验证、工程索引同步，最终交付。

## 必读规则

在开始任何编码任务前，必须先读取以下文件：

1. `.loom/memory/constitution.md` — 项目宪章（编码准则、红线、技术栈）
2. `.loom/rules/project-structure.md` — 工程结构约束（目录分层、架构模式）
3. `.loom/memory/MEMORY.md` — 项目记忆（踩坑记录、用户偏好）

**所有开发活动必须遵守以上两份文件。与之冲突以这两份文件为准。**

## 开发流程

```
brainstorming → writing-plans → git-worktree → subagent-dev → verification → index-update
```

{{SKILLS_SECTION}}

## 工程索引

`.loom/ENGINEERING-INDEX.md` 是项目索引，包含路由表、控制器/服务/模型层的方法签名、依赖关系和调用链。

**回答任何关于项目结构、路由、模块、方法签名、依赖关系的问题前，必须先读此索引。索引已覆盖签名级信息，绝大多数问题无需回退读源码。只有在需要修改具体实现逻辑时才读源码文件。**

## 完成工作后更新

代码变更后同步更新：

1. `.loom/ENGINEERING-INDEX.md` — 新增/删除了模块、路由、控制器、服务
2. `.loom/memory/MEMORY.md` — 踩坑、用户偏好、变更要点
3. `{{ENTRY_FILE}}` — 引入了新的约定或命令

## 记忆

持久化记录在 `.loom/memory/MEMORY.md`，新会话时先读此文件。
