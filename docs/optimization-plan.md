# Loom 优化方案（问题 2、3、4、7、8、9、12、13）

本文件将之前讨论的优化方案整理成可执行的任务清单、涉及新增/修改文件、示例代码片段与交付时序，便于下载、分享与在仓库中复现。

> 生成时间：2026-06-17
>
## 目标

针对以下问题给出可实现的改进：

- 问题 2：产物一致性检查不足
- 问题 3：并发控制过于简单（锁粒度、死锁、超时）
- 问题 4：记忆系统的持久化不清晰（store.json / MEMORY.md 同步）
- 问题 7：命令行接口过于复杂（run 命令职责过多、缺少交互）
- 问题 8：错误恢复机制不完整（诊断、恢复建议、恢复前安全检查）
- 问题 9：MCP Server 集成度低（无法安全使用写锁与验证）
- 问题 12：测试覆盖率不足（缺单元/集成/端到端测试）
- 问题 13：跨工具兼容性差（生成脚本分散、工具能力声明缺失）


## 输出文件（将新增/修改）

建议在仓库中新增或修改以下文件：

- src/core/artifact-validator.js  — 产物一致性校验器
- src/core/task-lock.js         — 细粒度任务级锁与死锁检测
- src/core/memory-manager.js    — 结构化记忆管理（store.json ↔ MEMORY.md）
- src/core/failure-diagnostics.js — 失败诊断与恢复建议
- src/commands/run-v2.js        — 重构的交互式 run 命令（可作为替代或逐步替换）
- src/commands/mcp-serve.js     — 增强的 MCP Server，包含验证与 task-lock 接口
- scripts/generate-unified.mjs  — 统一生成脚本，替代多脚本
- config/memory.schema.json    — memory store 的 schema
- tests/**                     — 单元/集成测试（artifact-validator, task-lock, pipeline-flow）


## 详细方案

以下对每个问题给出具体实现思路、示例与注意事项。

---

### 问题 2：产物一致性检查不足

目的：在推进流水线阶段前，强制验证该阶段期望产物存在且质量合格（无占位符、格式合理、测试报告明确等）。

实现要点：

- 新增 ArtifactValidator（src/core/artifact-validator.js），对每个 Skill 定义需要的必备产物与校验函数。
- 在 PipelineEngine.advance() 中调用 ArtifactValidator.validateSkillOutput()，如果返回不合格阻止推进并把错误信息暴露给 CLI / MCP。 
- 校验项示例：
  - spec.md：无占位符（{{…}} / TBD / TODO / FIXME / XXX）、长度阈值
  - plan.md：必须包含任务拆解（checklist 或表格）
  - subagent 输出：检测是否有源码变更、是否生成 test-report.md
  - verification-report.md：包含 spec-coverage、compilation、type-consistency 检查项

示例集成（已在 engine 中演示）：

- 如果 validation.valid === false，engine.advance() 返回详细 error，并提示如何修复。

注意事项：

- 校验规则应可配置（config/shared-rules.json 或 workflow step 的 outputs/requirements 字段）。
- 对于复杂检查（例如 codegraph 影响分析），当依赖不可用时降级为告警（warning），不阻断推进。

---

### 问题 3：并发控制过于简单

目的：支持 subagent 并行安全执行、避免全 spec 串行化，加入死锁与活锁检测与自动超时清理。

实现要点：

- 新增 TaskLock（src/core/task-lock.js）：每个 task 单独持有独立锁文件（.loom-tasks/<taskId>.lock），包含 pid、token、acquiredAt。
- 支持 acquireWithWait(taskId, timeoutMs) 以供 subagent 重试获取；支持 release(taskId) 释放。
- 支持 waitFor(taskIds, timeoutMs) 等待依赖任务完成。
- 提供 detectDeadlock(taskGraph) 接口，基于任务依赖图检测环路并返回阻塞链路。
- 在长时间无响应或 pid 不存在时，自动清理残留锁（超时策略）。

示例使用场景：

- subagent 在执行 task 前调用 taskLock.acquireWithWait('task-123')；执行结束后调用 release。
- 若 task 有依赖：先调用 taskLock.waitFor(['t1','t2'])。
- 在调度器中运行定期死锁检测，若检测到循环依赖，把相关 tasks 标注为 blocked 并通知用户。

注意事项：

- 锁文件目录应在 spec 内，受 repo 所有者控制。
- 进程退出时释放进程持有的锁（注册退出 handler）。

---

### 问题 4：记忆系统的持久化不清晰

目的：统一结构化记忆（store.json）与可读导出（MEMORY.md），实现可追溯、可合并的团队协作流程。

实现要点：

- 新增 MemoryManager（src/core/memory-manager.js），负责：
  - addEntry(type, content, metadata)
  - query(filters)
  - exportMemory()：把 store.json 导出为 .loom/memory/MEMORY.md（自动生成，勿手工编辑）
  - merge(remoteStorePath, conflictStrategy)
  - archive(featureSlug, sessionContent)
- 增加 config/memory.schema.json，定义 store.json 的 JSON-Schema 用于验证。
- index-update 阶段自动触发 exportMemory()，并把 MEMORY.md 写入 repo（或由用户决定是否 commit）。

同步策略建议：

- store.json 为真源（single source of truth），开发者不直接编辑 MEMORY.md。
- MEMORY.md 由 store.json 自动导出并可作为 PR 的可读文档；若需要团队合并 store.json，使用 MemoryManager.merge() 并触发冲突解决流程。

注意事项：

- 合并冲突可通过 `merge` 接口提供三种策略（local/remote/merge-with-conflict-markers）。
- 大团队场景下推荐把 `.loom/memory/store.json` 放在仓库或共享存储中，并在 CI 中检查其 schema。

---

### 问题 7：命令行接口过于复杂

目的：将 `loom run` 的多职责拆分或替换为更友好的交互式命令，保留脚本化选项以便自动化。

实现要点：

- 新建 `src/commands/run-v2.js`，提供交互式向导（inquirer）并兼容非交互模式下的 flags（--next, --approve, --recover）。
- 设计要点：
  - 无 state 时进入交互初始化流程（选择 pipeline type）
  - state 为 failed 时提供 diagnose + recover 向导
  - 当前阶段是 gate 时提供交互审批或 --approve 快速通过
  - 默认进入“推荐下一步”交互，支持直接推进或标记失败
- 保留原 run 命令作为非交互脚本接口，或逐步替换。

命令行示例：

- 交互初始化： loom run specs/2026-06-17-feature
- 自动推进： loom run specs/2026-06-17-feature --next
- 审批： loom run specs/2026-06-17-feature --approve

注意事项：

- 交互库（inquirer）将作为 devDependency 或 optional dependency；在无 tty 环境下自动降级为非交互模式。

---

### 问题 8：错误恢复机制不完整

目的：在流水线失败时提供可理解的诊断、恢复建议和恢复前安全性验证，减少手工探索时间。

实现要点：

- 新增 FailureDiagnostics（src/core/failure-diagnostics.js）提供：
  - diagnose(failureReason)：解析失败原因并归类（test_failure、compilation_error、git_conflict 等）
  - suggestRecovery(failureReason, currentStage)：给出分步恢复建议、时间估算与风险等级
  - verifyRecoverySafety(currentStage, nextStage)：在执行 recover 前检查前置产物、占位符、git 状态等
- 在 CLI 的失败恢复分支（run-v2）中集成诊断结果并以交互方式让用户选择恢复策略。

注意事项：

- 自动诊断基于失败原因字符串与常见日志样式，可逐步扩展规则库。
- 若诊断不确定，优先展示“手工检查”清单而非自动恢复。

---

### 问题 9：MCP Server 集成度低

目的：把 MCP Server 的能力（读取状态、验证产物、获取/获取 task 锁）暴露为安全的工具接口，以便 AI 或外部系统可可靠使用。

实现要点：

- 在 `src/commands/mcp-serve.js` 中实现以下 tools/resources：
  - loom_init_pipeline
  - loom_advance_pipeline（内置 artifact 验证）
  - loom_acquire_task / loom_release_task（基于 TaskLock）
  - loom_validate_artifacts
  - loom_diagnose_failure
- 通过 MCP 返回可读的消息（包含错误/警告/建议），并在需要写操作时通过 TaskLock/SpecLock 做原子保护。
- MCP 的 advance 操作默认进行 artifact 验证，除非显式传入 validate=false。

注意事项：

- MCP server 运行时应把 SpecDir 明确传入每个工具请求；避免使用全局 cwd 导致竞态。
- 若 MCP 与本地文件系统隔离（远端部署），需要适配远端存储或 RPC 存储层。

---

### 问题 12：测试覆盖率不足

目的：为核心模块（artifact-validator、task-lock、pipeline-engine、memory-manager 等）补充单元测试和集成测试，保证规则变更有 CI 保障。

实现要点：

- 使用 vitest 作为测试框架（仓库已包含），新增测试目录 `tests/`：
  - tests/unit/artifact-validator.test.js
  - tests/unit/task-lock.test.js
  - tests/integration/pipeline-flow.test.js
- 增加一个内存文件系统 mock（tests/mocks/memory-fs.js）以便在测试中控制文件状态。
- 在 package.json 添加脚本：
  - test:unit, test:integration, test:e2e, test (总合)
- 在 CI（如 GitHub Actions）中把 `npm run generate:check` 与 `npm test` 放在 pre-check 步骤中，阻止过期生成或破坏行为合并。

测试示例要点：

- artifact-validator 能检测占位符、缺失文件、测试报告缺失等
- task-lock 能并发处理不同 task、阻止同 task 并发、检测环形依赖
- pipeline 流程模拟 finish/advance/approve/fail 情形

---

### 问题 13：跨工具兼容性差

目的：统一生成脚本，使用工具能力声明（config/tool-capabilities.yaml）作为单一源，减少散落的 generate-* 脚本数量并降低维护成本。

实现要点：

- 新增 config/tool-capabilities.yaml，定义每个工具（claude-code、opencode、cursor、copilot、codex）的能力集（skills/hooks/plugin/mcp）与 entryfile 映射。
- 合并生成脚本为 scripts/generate-unified.mjs：读取 tool-capabilities.yaml 与 config/tools.schema.json，生成每个工具需要的 entry 文件（CLAUDE.md、AGENTS.md、.cursorrules、.github/copilot-instructions.md 等）。
- 支持 `--check` 模式用于 CI 检查；若文件需要更新则退出非零，提示开发者运行生成脚本。

注意事项：

- 保持生成逻辑幂等，避免在每次安装时触发无意义更新。
- 在 prepack/prepublishOnly 中加入生成步骤，确保发布包内的 entry 文件一致。

---

## 迭代与时间计划（建议）

按优先级安排迭代：

1. 快速交付（1 周）
   - artifact-validator 基础实现并集成至 PipelineEngine.advance
   - task-lock 基础实现（单任务锁 + acquire/release）
   - 在 CI 中加入 generate:check 与 unit tests 基本骨架

2. 并发与恢复（1-2 周）
   - task-lock 扩展（acquireWithWait、waitFor、deadlock 检测）
   - failure-diagnostics 初版与 run-v2 的诊断集成

3. 记忆与 MCP（1 周）
   - memory-manager 完整实现与 exportMemory
   - mcp-serve 增强版（artifact validate, task lock 接口）

4. 测试覆盖与工具统一（2 周）
   - 完善 tests（单元/集成/端到端）
   - generate-unified.mjs 与 tool-capabilities.yaml

总估算： 4-6 周（并行开发可压缩）


## 交付清单（代码片段与路径）

- src/core/artifact-validator.js  — 实现产物校验逻辑
- src/core/task-lock.js          — TaskLock 类（并发、超时、死锁检测）
- src/core/memory-manager.js     — MemoryManager
- src/core/failure-diagnostics.js — FailureDiagnostics
- src/commands/run-v2.js         — 交互式 run
- src/commands/mcp-serve.js      — 增强 MCP Server
- scripts/generate-unified.mjs   — 统一生成脚本
- config/memory.schema.json     — memory schema
- tests/                         — 单元/集成测试


## 后续建议

- 把上述改动拆成小 PR（每个模块单独 PR），便于审查与回滚。
- 在 CI 中强制执行 `node scripts/generate-unified.mjs --check` 与 `npm test`。
- 将 MemoryManager 的 store.json 作为团队共享资源（例如在 repo 中或由远端 DB 托管），并提供合并流程。


---

如需我现在把上述文件实际写入仓库（在 `docs/optimization-plan.md` 或其他位置），我可以立即创建提交并返回下载链接；如果你希望先审阅我将写入的确切内容或文件路径，请告知要放置的路径或对内容的任何修改指示。