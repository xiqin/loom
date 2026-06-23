> 本文件由 loom init-project 自动生成。修改长期规则请编辑 `.loom/` 下的源文件，再重新分发到各 AI 编码工具。

## 上下文读取策略（渐进式）

开始编码、调试或代码审查前，**按需**读取上下文，避免一次注入过多内容：

### 第一步：获取项目状态概览

优先使用 MCP 工具获取摘要，而非整文件读取：

1. 若当前只看到 meta 工具，先调用 `loom_list_capabilities`，再用 `loom_load_tool_group(group="pipeline"|"context")` 加载所需工具。
2. `loom_get_project_status` — 获取活跃流水线、阶段、任务概要
3. `loom_get_context(doc="constitution")` / `"memory"` — 先取 outline（L0），只在需要某 section 时才取 L1 全文
4. codegraph：仅在可用时使用 `codegraph_search` / `codegraph_context` / `codegraph_impact`；不可用时跳过图查询并用源码搜索补充判断

### 第二步：按需深入（仅在任务涉及时）

按需深入读取以下文件（用 MCP 工具去取，不要整文件 cat）：

- `.loom/rules/constitution.md`：仅当任务涉及架构决策、目录结构或分层约束时读取全文
- `.loom/memory/MEMORY.md`：仅当需要回忆历史决策时读取导出视图；新增记忆用 `loom_add_memory` 或 `loom memory add`

**默认不要一口气读取所有上下文文件全文。仅在变更涉及架构决策或跨多模块时例外。**

## 开发流水线（智能优先，类型兜底）

收到功能需求或开发任务时，**优先走智能选择**让 `loom-pipeline-selector` 按需求自动选步骤；**仅当智能选择失败或无法判断时**，回退到类型模式按预设流水线执行。

### 第一步：智能选择（优先）

调 MCP 工具 `loom_select_pipeline`（或 CLI `loom select --spec-dir <dir> --request "<需求>"`），传入用户需求描述。选择器三段决策：

1. **规则短路**：关键词命中（typo/小修复/hotfix/依赖升级/根因明确的 bug）→ 0 token 直接返回固定步骤
2. **AI fallback**：信号模糊时调 AI（若注入 aiClient）从 `step_catalog` 选步骤
3. **规则兜底**：无 AI 或 AI 失败时按风险等级生成基础流程

选择器自动校验护栏：`must_include`（executing + verification）、`dependency_closure`（选 step 自动带 producer）、`never_skip_gates`（planning 后必插 approved）、`max_steps: 8`。

结果必须先明确告知用户，至少包含：

- 用户需求 + AI 分析（风险/关键词/影响文件/spec 状态/worktree 状态）
- 选择步骤（含 skill、requires、outputs）
- 来源（short-circuit / ai / fallback）+ 理由

初始化后，选择结果写入 `specs/<date+feature>/pipeline.state.json` 的 `dynamic_steps`，并由 loom 自动生成/更新 `progress.md`，记录当前阶段和动态步骤。后续 AI 即使没有对话上下文，也必须先读取 pipeline context / status，再按状态继续。

### 第二步：失败回退类型模式

**仅当以下情况**回退类型模式：

- `loom_select_pipeline` 抛错或返回空 steps
- 智能选择步骤超出 `max_steps=8`（提示用户拆分后仍超）
- `.loom/workflow.yaml` 缺少 `step_catalog` 或 `selection_rules`
- 用户显式指定 `--type <X>` 跳过智能选择

回退后按 `.loom/workflow.yaml > pipelines.<type>` 的固定步骤执行，类型表：

| 类型           | 适用场景                                                                | 复杂度 |
| -------------- | ----------------------------------------------------------------------- | ------ |
| `feature`      | 新功能开发                                                              | 高     |
| `bugfix`       | 已定位的 bug 修复                                                       | 中     |
| `hotfix`       | 生产紧急问题                                                            | 中     |
| `refactor`     | 代码重构                                                                | 中-高  |
| `quickfix`     | 单文件小改动、配置微调、已知 bug 小修复                                 | 低     |
| `chore`        | 依赖升级、配置调整、文档更新等低风险改动                                | 低     |
| `pm-prototype` | PM 需求到原型：需求 → spec → HTML 原型（无编码）                        | 中     |
| `qa`           | QA 验收测试：变更范围分析 → 用例生成 → 自动化执行 → 手动确认 → 报告汇总 | 中     |

无法判断类型时默认 `feature`，并告知用户。

### 第三步：向用户展示选择结果

简化展示：

```
📋 流水线（来源：<source|type-mode>，风险：<risk>）：
<step1> → <step2> → ... → <stepN>

理由：<reasoning>
```

执行方式：

- 默认：用户知晓后，`loom run --spec-dir <dir> --auto --request "<需求>"` 直接写入 `dynamic_steps` 并初始化，同时生成/更新 `progress.md`
- 需要先审查或手动调整：`loom select --spec-dir <dir> --request "<需求>"` 生成 `pipeline-plan.md`，调整后执行 `loom run --spec-dir <dir> --approve-pipeline`
- 重新选择：`loom run --spec-dir <dir> --auto --request "<新需求>"`

### 第四步：按步骤执行

用户知晓后（quickfix/chore 类短路命中只需简短说明），按选择的步骤执行：

1. **加载对应 skill**（`step.skill` 字段指定的 skill，`null` 表示直接执行无特定 skill）。
2. **执行该 skill 的流程**，产出对应产物。
3. **遇到 `gate: human-approval` 时，停下来等待用户确认**。
4. **通过 loom 状态机更新进度**：阶段完成后用 `loom_advance_pipeline` / `loom run --advance` 推进；遇到失败用 `loom run --fail <reason>` 标记。`progress.md` 由 loom 自动生成/更新，不手动编辑。
5. **完成后告知用户**本步骤产物，再进入下一步。
6. **执行中发现跨模块影响**：调 `loom_adjust_pipeline` 追加步骤（保留已完成阶段）。

### Subagent 触发规则

**不是所有任务都应使用 subagent。** 以下条件满足**任意一条**时才启用 `loom-subagent-driven-development`：

- 涉及 3 个以上 task 文件
- 预计改动 5 个以上源文件
- 需要跨模块搜索或并行探索
- 有安全、数据一致性、迁移或权限风险
- 主上下文已严重污染，需要隔离重试

**不满足以上条件时，由主 agent 直接执行，不派发 subagent。**

### 特殊规则

- **验证未通过**：回到 `executing` 步骤修复，不重跑整个流水线。
- **小改动**（单文件修复、配置调整）：智能选择会命中 `quickfix` 短路，跳过规划和审批。
- **workflow.yaml 不可读**：停止执行，告知用户文件缺失，不得凭记忆假设流水线内容。
- **步骤中途失败**：用 `loom run --fail <reason>` 记录失败，向用户报告失败原因和建议，等待指示。
- **智能选择超 max_steps=8**：提示用户拆分需求；拆分后仍超则回退类型模式。
- **无上下文续跑**：先读 `loom_get_pipeline_context` / `loom_get_project_status` 或 `pipeline.state.json` + `progress.md`，以 `dynamic_steps` 和当前阶段为准继续执行。
- **需要人工调整步骤**：用 `loom select` 生成 `pipeline-plan.md`，调整后再 `--approve-pipeline`；不要把 `pipeline-plan.md` 作为默认续跑依据。
- **quickfix 升级**：执行中发现改动涉及 2+ 文件或跨模块依赖，立即暂停并告知用户，建议升级为 `bugfix` 流水线。

## 工作方式

- 先理解需求和现有约定，再做最小必要改动。
- subagent/并行执行只用于相互独立、边界清楚的任务；主线阻塞工作由当前 agent 负责。
- 优先使用 MCP 工具渐进获取上下文，而非整文件读取。
- 外部服务、浏览器、数据库、CI 或 issue 系统优先通过 MCP、插件或本地命令访问。

## 完成前检查

交付前确认：

1. 相关验证命令已经运行，或明确说明无法运行的原因。
2. 新增/删除的路由、模块、命令、关键约定已同步 codegraph（`loom index`：codegraph 可用时委派 `codegraph sync`；不可用时注明已跳过）。
3. 重要踩坑、用户偏好或跨会话决策已通过 `loom_add_memory` 或 `loom memory add` 记录。
