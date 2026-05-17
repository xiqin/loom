> 本文件由 loom init-project 自动生成。修改请编辑 `.loom/` 源文件。重新运行 `/loom-init-project` 将重新分发。

# loom — Weave Specs into Execution

AI 工程化框架。从需求描述出发，经过头脑风暴、计划拆解、隔离开发、代码审查、完成前验证、工程索引同步，最终交付。

## 开发流程（硬性约束 · 必须严格执行）

必须遵循 `.loom/workflow.yaml` 定义的开发流水线。
**任何新增功能或接口，必须严格按`.loom/workflow.yaml`定义的流水线步骤执行，不可跳过、不可合并步骤。**

1. 开始功能开发时，读取 `.loom/workflow.yaml` 从第一步开始执行，禁止跳步、禁止逆序执行
2. 每完成一个步骤，更新 `progress.md`，然后查询 `workflow.yaml` 找到 `next`，立即调用对应的 skill
3. 遇到 `gate: human-approval` 的步骤时，必须停止并等待用户明确确认后才能继续

## 必读规则

在开始任何编码任务前，必须先读取以下文件：

1. `.loom/rules/constitution.md` — 项目宪章（编码准则、红线、技术栈）
2. `.loom/rules/project-structure.md` — 工程结构约束（目录分层、架构模式）

**所有编码行为必须遵守以上两份文件。与之冲突以这两份文件为准。**

{{SKILLS_SECTION}}

## 工程索引

当 **graphify 可用**时，优先使用知识图谱（ + ）作为工程索引。当 **graphify 不可用**时，使用手动索引。

`graphify-out/` 是**graphify**知识图谱索引。
`.loom/index/engineering-index.md` 是手动索引，包含路由表、控制器/服务/模型层的方法签名、依赖关系和调用链。

**回答任何关于项目结构、路由、模块、方法签名、依赖关系的问题前，必须先读索引。graphify 可用时读图谱报告，否则读手动索引。只有在需要修改具体实现逻辑时才读源码文件。**

## 完成工作后更新

代码变更后同步更新：

1.  — 新增/删除了模块、路由、控制器、服务（graphify 可用时由知识图谱替代）
2.  `.loom/memory/MEMORY.md` — 踩坑、用户偏好、变更要点
3.  `{{ENTRY_FILE}}` — 引入了新的约定或命令

## 记忆

持久化记录在 `.loom/memory/MEMORY.md`，新会话时先读此文件。
