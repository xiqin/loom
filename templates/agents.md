> 本文件由 loom init-project 自动生成。修改长期规则请编辑 `.loom/` 下的源文件，再重新分发到各 AI 编码工具。

## 必读上下文

开始编码、调试或代码审查前，先按需读取：

1. `.loom/rules/constitution.md`：项目原则、技术栈、验证命令和红线。
2. `.loom/rules/project-structure.md`：目录分层、架构模式和放置约定。
3. `.loom/index/engineering-index.md`：路由、模块、方法签名、依赖关系和调用链索引。
4. `.loom/memory/MEMORY.md`：长期记忆、踩坑记录和用户偏好。

## 开发流水线（强制）

收到功能需求或非平凡开发任务时，**必须按以下顺序执行**，严禁跳步：

| # | 阶段 | Skill | 产出 | Gate |
|---|------|-------|------|------|
| 1 | 需求探索 | `loom-brainstorming` | `specs/<date+feature>/spec.md` | 用户确认 spec |
| 2 | 计划拆解 | `loom-writing-plans` | `specs/<date+feature>/plan.md` + `tasks/` | 用户确认 plan |
| 3 | 分支隔离 | `loom-using-git-worktrees` | feature 分支 | — |
| 4 | 编码执行 | `loom-subagent-driven-development` | 源码 + 测试报告 `specs/<date+feature>/test-report.md` | reviewer pass |
| 5 | 完成验证 | `loom-verification-before-completion` | verify-report.md | 验证通过 |
| 6 | 索引同步 | `loom-index-update` | 索引/记忆更新 | — |

**规则：**
- 每个阶段完成后**必须加载对应 skill** 并显式触发下一阶段。
- `gate: human-approval`（阶段 1、2）必须等待用户确认后才能继续。
- 每个阶段开始/完成/失败时更新 `specs/<date+feature>/progress.md`：对应 Step 设为 `▶ 进行中` / `✅ 完成` / `❌ 失败`，时间填实际 HH:mm，备注列注明产物。
- 验证未通过时回到阶段 4 修复，不重跑整个流水线。
- 小改动（单文件修复、配置调整）可跳过流水线，但需明确告知用户。

## 工作方式

- 先理解需求和现有约定，再做最小必要改动。
- subagent/并行执行只用于相互独立、边界清楚的任务；主线阻塞工作由当前 agent 负责。
- 外部服务、浏览器、数据库、CI 或 issue 系统优先通过 MCP、插件或本地命令访问。

## 完成前检查

交付前确认：

1. 相关验证命令已经运行，或明确说明无法运行的原因。
2. 新增/删除的路由、模块、命令、关键约定已同步到 `.loom/index/engineering-index.md`。
3. 重要踩坑、用户偏好或跨会话决策已记录到 `.loom/memory/MEMORY.md`。
