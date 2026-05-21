> 本文件由 loom init-project 自动生成。修改长期规则请编辑 `.loom/` 下的源文件，再重新分发到各 AI 编码工具。

## 必读上下文

开始编码、调试或代码审查前，先按需读取：

1. `.loom/rules/constitution.md`：项目原则、技术栈、验证命令和红线。
2. `.loom/rules/project-structure.md`：目录分层、架构模式和放置约定。
3. `.loom/index/engineering-index.md`：路由、模块、方法签名、依赖关系和调用链索引。
4. `.loom/memory/MEMORY.md`：长期记忆、踩坑记录和用户偏好。

## 工作方式

- 先理解需求和现有约定，再做最小必要改动。
- 需要完整功能开发时，读取 `.loom/workflow.yaml`，按其中步骤推进；遇到 `gate: human-approval` 必须等待用户确认。
- subagent/并行执行只用于相互独立、边界清楚的任务；主线阻塞工作由当前 agent 负责。
- 外部服务、浏览器、数据库、CI 或 issue 系统优先通过 MCP、插件或本地命令访问，不把临时凭据和环境细节写进规则文件。

## 完成前检查

交付前确认：

1. 相关验证命令已经运行，或明确说明无法运行的原因。
2. 新增/删除的路由、模块、命令、关键约定已同步到 `.loom/index/engineering-index.md`。
3. 重要踩坑、用户偏好或跨会话决策已记录到 `.loom/memory/MEMORY.md`。
