> 本文件由 loom init-project 自动生成。修改长期规则请编辑 `.loom/` 下的源文件，再重新分发到各 AI 编码工具。

## 上下文读取与续跑

开始编码、调试或代码审查前，按需读取上下文：优先使用 MCP 获取摘要并逐层深入，不要一次注入所有文件全文；仅当变更涉及架构决策或跨多模块时例外。

1. 若当前只看到 meta 工具，先调用 `loom_list_capabilities`，再用 `loom_load_tool_group(group="pipeline"|"context")` 加载所需工具。
2. 用 `loom_get_project_status` 获取活跃流水线、阶段和任务概要。
3. 用 `loom_get_context(doc="constitution")` / `"memory"` 先取 outline（L0），只在需要某个 section 时取 L1 全文。
4. 图后端（codegraph / sourcegraph / scip）由 `.loom/graph.config.json` 决定；已启用时用 `loom_graph_query` 查询代码依赖，未启用或不可用时改用源码搜索和 git diff。

仅在任务涉及相应内容时深入读取：

- `.loom/rules/constitution.md`：仅当任务涉及架构决策、目录结构或分层约束时读取全文。
- `.loom/memory/MEMORY.md`：仅当需要回忆历史决策时读取导出视图；新增记忆用 `loom_add_memory` 或 `loom memory add`。
- 结构化账本、收据和 implementation packet：按“结构化治理与账本”一节规定的阶段读取。

阶段切换或无上下文续跑时，按以下顺序恢复：

1. 读取 `loom_get_pipeline_context` / `loom_get_project_status`，或 `pipeline.state.json` + `progress.md`。
2. 以 `dynamic_steps` 和当前阶段为准。
3. 先读 `progress.md` 中的 Handoffs 摘要；仅当摘要不足时，再按需读取 `handoffs/<stage>.json`。

## 入口路由

收到新请求时先做轻量判断；需要时加载 `loom-router`。router 只负责分流和解释，不写 `pipeline.state.json`，不生成 `dynamic_steps`，也不替代 `loom-pipeline-selector`。

- 新功能、跨模块改动、开发型任务：说明原因后交给 `loom-pipeline-selector` 选择 steps。
- bug、测试失败、异常行为：优先进入 `loom-systematic-debugging`，先建立 red-capable feedback loop。
- 需求含糊、设计取舍多：进入 `loom-brainstorming`，必要时一问一答澄清。
- 准备审查：进入 `loom-requesting-code-review`，先做 Standards + Spec 双轴预审查和 Spec 遗漏自审。
- QA 验收、分支收尾、索引同步、技能编写、loom 使用咨询：分别进入对应 skill，不要强行启动开发流水线。

需要建立开发流水线的任务，由 selector 在结构化治理约束下按下一节选择具体步骤。

## 流水线选择与确认

### 智能选择

默认调用 MCP `loom_select_pipeline`，或 CLI `loom select --spec-dir <dir> --request "<需求>"`。选择器按以下优先级决策：

1. **supplied assessment**：调用方提供结构化工程事实时优先采用。
2. **AI assessment**：若注入 aiClient，由 AI 只提取影响、范围、变更类型、置信度和证据，不直接选择 risk、governance 或 steps。
3. **兼容规则短路**：没有有效 assessment 时，hotfix、quickfix、chore 和根因明确的 bug 可命中固定策略；hotfix 优先级最高。
4. **保守规则兜底**：无法获得完整事实时，除明确高风险信号外，至少使用 medium 风险、standard 治理。

代码根据 assessment 确定性计算 risk、governance 和 steps，并校验 `must_include`、按治理级别生效的 `mandatory_for`、`dependency_closure`、人工 gate 和 `max_steps: 13`。关键影响未知时不得进入 lightweight；structured 新任务即使当前没有 spec/plan 文件，也必须包含 detail-expansion、analyze-artifacts 和 converge。

### 展示与确认门禁

首次选择必须省略 `initialize` 或传 `initialize=false`；CLI 首次调用必须使用 `loom select`。向用户展示以下内容并等待明确确认，之后才能初始化或执行；quickfix/chore 短路也不得绕过此确认：

- 用户需求 + AI 分析（风险、关键词、影响文件、spec 状态、worktree 状态）
- 选择步骤（含 skill、requires、outputs）
- 来源（short-circuit / ai / fallback）和理由

简化展示格式：

```
📋 流水线（来源：<source|type-mode>，风险：<risk>）：
<step1> → <step2> → ... → <stepN>

理由：<reasoning>
```

禁止在展示结果前调用 `loom run --auto` 或 MCP `loom_select_pipeline initialize=true`，也禁止用“需求很简单”“我直接执行”绕过确认。

用户明确确认后，调用 `loom_select_pipeline initialize=true`，或执行 `loom run --spec-dir <dir> --auto --request "<需求>"`，把选择结果写入 `specs/<date+feature>/pipeline.state.json` 的 `dynamic_steps`，并由 loom 自动生成或更新 `progress.md`，记录当前阶段和动态步骤。

- 需要先审查或手动调整：用 `loom select --spec-dir <dir> --request "<需求>"` 生成 `pipeline-plan.md`，调整后执行 `loom run --spec-dir <dir> --approve-pipeline`；`pipeline-plan.md` 不作为默认续跑依据。
- 重新选择：`loom run --spec-dir <dir> --auto --request "<新需求>"`。

### 类型模式回退

仅在以下情况进入类型模式：

- `loom_select_pipeline` 抛错或返回空 steps。
- 智能选择超过 `max_steps=13`：先提示用户拆分，拆分后仍超限才回退。
- `.loom/workflow.yaml` 可读，但缺少 `step_catalog` 或 `selection_rules`。
- 用户显式指定 `--type <X>` 跳过智能选择。

回退后按 `.loom/workflow.yaml > pipelines.<type>` 的固定步骤执行：

| 类型 | 适用场景 | 复杂度 |
| --- | --- | --- |
| `feature` | 新功能开发 | 高 |
| `bugfix` | 已定位的 bug 修复 | 中 |
| `hotfix` | 生产紧急问题 | 中 |
| `refactor` | 代码重构 | 中-高 |
| `quickfix` | 单文件小改动、配置微调、已知 bug 小修复 | 低 |
| `chore` | 依赖升级、配置调整、文档更新等低风险改动 | 低 |
| `pm-prototype` | PM 需求到原型：需求 → spec → HTML 原型（无编码） | 中 |
| `qa` | QA 验收测试：变更范围分析 → 用例生成 → 自动化执行 → 手动确认 → 报告汇总 | 中 |

进入类型模式后仍无法判断类型时，默认 `feature` 并告知用户。

## 按步骤执行

用户完成选择确认后：

1. 加载 `step.skill` 指定的 skill；`null` 表示直接执行，无特定 skill。
2. 执行该 skill 的流程并产出对应产物。
3. 遇到 `gate: human-approval` 时停止并等待用户确认。若阶段声明 `approval_requires`（如 review-gate 要求 `review-feedback.md`），必须先补齐文件并通过 verdict 检查，再等待用户 approve；不得空审批。
4. 完成后告知用户本步骤产物，再进入下一步。
5. 执行中发现跨模块影响时，调用 `loom_adjust_pipeline` 追加步骤并保留已完成阶段；若新信号触发 detail-expansion、analyze-artifacts、converge 或 omission-hunter，按状态机追加执行，不得手动跳过。

### Handoff、压缩与推进

阶段 outputs 声明 `handoffs/<stage>.json` 时，严格按以下顺序执行：

1. 调用 `loom_stage_checkpoint` 或写入对应 handoff。
2. checkpoint 返回后，立即调用当前宿主环境的 `compress`，压缩已结束阶段的原始对话、探索搜索输出、中间推理和大段日志。
3. 再调用 `loom_advance_pipeline` 并传 `compression_confirmed=true`，或执行 `loom run --advance --compression-confirmed`。

不得使用把 checkpoint 和推进合并到同一次调用中的路径绕过压缩点。未声明 handoff output 的阶段按状态机直接推进。`progress.md` 由 loom 自动生成或更新，不手动编辑。

压缩时保留 `spec.md`、`plan.md`、`tasks/`、`requirements.json`、`traceability.json`、`pipeline.state.json`、`progress.md`、`handoffs/`、`receipts/`、`implementation-packets/` 和必要报告；续跑时不要重新加载旧阶段原始对话或完整日志。

### Validator 与失败处理

`loom_advance_pipeline` 可能因 step 声明的 validator（如 `task-state-closure`、`requirement-task-closure`、`planning-artifacts`、`verification-artifacts`、`review-receipts-pass`、`diff-within-ownership`、`convergence-pass`、`no-blocking-findings`）返回 `ok:false` 和具体错误，例如 `task state closure failed`、`requirement-task closure failed`、`verification artifact validation failed: traceability.json ...` 或 `planning artifact validation failed: traceability.json ...`。此时按错误回到对应阶段补齐结构化账本、任务状态或证据收据后再推进；禁止重跑整个流水线、重新 brainstorming 或直接修改 `pipeline.state.json` 绕过 validator。

常见修复路径：

- `task-state-closure`：把缺失的 `tasks/Tn.md` 在 `task-states/Tn.state.json` 中标记为 `done`。
- `requirement-task-closure`：把 `spec.md` 中的每个 `REQ-xxx` 至少写入一个 `tasks/Tn.md` 的 frontmatter `requirements`。
- `planning-artifacts`：在 `traceability.json` 为每个 `REQ-xxx` 和 `REQ-xxx-Bnn` 补 task 映射；`tests`/`evidence` 可由 executing 补齐。
- `verification-artifacts`：在 `test-report.md`/`verify-report.md` 提到每个 `REQ-xxx`，并把 behavior 级 `tests`/`evidence` 补齐到真实文件。
- 审批 stale / review-gate 空审批：补齐 `review-feedback.md` 且 `verdict: PASS`，或回到对应阶段重写受影响的 approved 产物并重新 approve。

其他失败按类型处理：

- verification 未通过：回到 `executing` 修复，不重跑整个流水线。
- 普通步骤中途失败：用 `loom run --fail <reason>` 记录，向用户报告原因和建议，等待指示。
- `.loom/workflow.yaml` 不可读：停止执行并告知用户文件缺失，不得凭记忆假设流水线内容。
- quickfix 执行中发现改动涉及 2+ 文件或跨模块依赖：立即暂停并告知用户，建议升级为 `bugfix` 流水线。

单文件修复或配置调整等小改动会命中 quickfix 短路，跳过规划和阶段审批，但不跳过首次流水线选择确认。

## 结构化治理与账本

下列 skill 通过 `step_catalog` 暴露。feature/refactor 等 structured 主线按治理级别强制执行 detail-expansion、analyze-artifacts 和 converge；standard 与 lightweight 不会仅因已有文件而升级。quickfix/chore 短路显式跳过结构化闭包，避免轻量流程被阻断。

### 质量 skill

- `loom-detail-expansion`：brainstorming 后、planning 前，按 15 个固定维度把 `requirements.json` 中的 REQ 展开为可独立验证的 Behavior Obligation；涉及输入、权限、写操作、状态变化、并发、外部依赖、安全、性能、可观测性等需求必须追加相应 behavior。
- `loom-analyze-artifacts`：planning 后、approved 前，只读分析跨产物一致性，包括重复、歧义、欠规格、behavior 缺失、task 未映射、traceability 缺失、依赖环、owns 冲突和非功能要求遗漏；输出 `artifact-analysis.json`，blocker 阻断 approved gate。
- `loom-converge`：executing 后、verification 前，对照意图清单反查代码，把 missing/partial/contradicts 生成新 task 回流 executing，直到收敛；输出 `convergence-report.json`，最多 3 轮，内部可触发 `loom-omission-hunter`。
- `loom-omission-hunter`：只读对抗式审查，从 behavior 反查应有但缺失的代码、测试、预期副作用、禁止副作用、失败场景、公共 API 变更、不变量保护和可观测性；输出 `findings/omission-hunter.json`，blocker 回流 converge。

### 阶段读取契约

- 进入 `planning` 前读 `requirements.json`：每个 `REQ-xxx` 必须声明 `types`、`required_categories` 和 `behaviors`；每个 behavior 必须有 `category`、`description`、`status`、`acceptance` 和 `test_plan`。
- 进入 `executing` 前读 `traceability.json`：每个 `REQ-xxx` 与 `REQ-xxx-Bnn` behavior 至少映射到一个 `tasks/Tn.md`；`tests`/`evidence` 此时允许为空，由 executing 补齐。
- 进入 `verification` 前再次读 `traceability.json`：每个 REQ/behavior 的 `tasks`、`tests` 和 `evidence` 都必须指向真实文件，且 `evidence` 与 `test-report.md` 的 evidence receipt 一致。
- 阶段涉及结构化收据时，读取 `receipts/implementations`、`receipts/tests`、`receipts/reviews` 和 `receipts/evaluations`，确认证据可验证。
- 阶段涉及 implementation packet 时，读取 `implementation-packets/T*.json`，确认 `packet_sha256` 未过期、`allowed_files` 覆盖当前改动。

### 最终闭环

feature/refactor 等 structured 主线交付前必须满足：

- `spec.md` 中每个 `REQ-xxx` 都出现在 `requirements.json`，且至少有一个对应 behavior（`REQ-xxx-Bnn`）。
- 每个 behavior 在 `traceability.json` 中都有 `tasks`、`tests` 和 `evidence`，且均指向真实文件。
- `test-report.md` 与 `verify-report.md` 都提到每个 `REQ-xxx`，且 evidence receipt 与 `traceability.json` 的 `evidence` 一致。
- 使用结构化收据时，`receipts/implementations`、`receipts/tests`、`receipts/reviews` 和 `receipts/evaluations` 下的 JSON 通过 schema 校验，且 `git_tree`、`git_commit`、`diff_sha256` 绑定当前代码版本。
- 使用 implementation packet 时，`implementation-packets/T*.json` 的 `packet_sha256` 未过期，`allowed_files` 覆盖本次改动。

## Subagent 与会话卫生

subagent/并行执行只用于相互独立、边界清楚的任务；主线阻塞工作由当前 agent 负责。在此前提下，满足以下任意一条才启用 `loom-subagent-driven-development`：

- 涉及 3 个以上 task 文件。
- 预计改动 5 个以上源文件。
- 需要跨模块搜索或并行探索。
- 有安全、数据一致性、迁移或权限风险。
- 主上下文已严重污染，需要隔离重试。

不满足以上条件时，由主 agent 直接执行，不派发 subagent。

每个 subagent 的上下文必须包含：

- 当前 `tasks/Tn.md` 的 frontmatter `requirements` 和 `behavior_ids`，以及 `requirements.json` 中对应 REQ 的 `behaviors`（含 `category`、`description`、`acceptance`、`test_plan`）。
- `traceability.json` 中该 task 对应 REQ/behavior 的现有 `tasks`、`tests`、`evidence` 映射。
- 需要补齐的 `test_plan` 与 `must_preserve` 不变量；若使用 implementation packet，从 `implementation-packets/T*.json` 读取。

subagent 完成时，必须为当前 task 的每个 `behavior_ids` 在 `traceability.json` 中补齐真实 `tests` 和 `evidence` 引用；只更新 REQ 级而未更新 behavior 级视为未完成，禁止把 task 标记为 `done`。

会话选择：

- 继续当前会话：同一需求澄清链路、同一 bug 的反馈环收敛中、同一小任务的实现与验证。
- 写 handoff 后推进：brainstorming、planning、executing、verification 等声明 handoff output 的阶段，遵循“按步骤执行”中的 handoff、压缩和推进规则。
- 开 fresh session 或隔离 subagent：每个独立 issue 的实现、prototype 探索、并行任务、高风险实验、主上下文明显污染或需要隔离重试。
- 不要开新会话：grilling/澄清中途、pipeline selector 等待用户确认前、阶段尚未写应有 handoff 时。

## 工作方式

- 先理解需求和现有约定，再做最小必要改动。
- 优先使用 MCP 工具渐进获取上下文。
- 外部服务、浏览器、数据库、CI 或 issue 系统优先通过 MCP、插件或本地命令访问。

## 完成前检查

交付前确认：

1. 相关验证命令已经运行，或已明确说明无法运行的原因。
2. 若启用了图后端（见 `.loom/graph.config.json`），已通过 `loom_graph_sync` 同步图索引；未启用时跳过。
3. 重要踩坑、用户偏好或跨会话决策已通过 `loom_add_memory` 或 `loom memory add` 记录。
4. feature/refactor 等 structured 主线已满足“结构化治理与账本 > 最终闭环”。
5. `loom_advance_pipeline` 在最终阶段返回 `ok:true`，且无 `task-state-closure`、`requirement-task-closure`、`planning-artifacts`、`verification-artifacts` 等错误；若仍报错，按“Validator 与失败处理”补齐账本，不要提交。
6. CLI 自检（可选但推荐）：
   - `npm run requirements:check -- --spec-dir <dir>` 通过。
   - `npm run traceability:check -- --spec-dir <dir> --required` 通过。
   - 使用 implementation packet 时，`npm run packets:check -- --spec-dir <dir> --task <Tn>` 通过。
