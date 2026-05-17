---
name: loom-writing-plans
description: >
  拆解实现计划。当有 spec 设计文档后，拆分为可执行的 task 列表。
  Use when: a spec design document exists and needs to be broken into bite-sized implementation tasks.
  Trigger keywords: 写计划, 拆分任务, 计划拆解, writing plan
---

# 实现计划拆解

## 触发条件

- brainstorming 完成，`specs/<date+feature>/spec.md` 已存在
- 用户确认设计方案后自动触发

## 状态输出

- 开始：`▶ pipeline [■■□□□□] Step 2/6 — 计划拆解 (writing-plans) | 功能: <功能名> | status: 开始`
- 完成：`✅ pipeline [■■□□□□] Step 2/6 — 计划拆解 | 完成 (N 个 task) | → Step 3: git-worktree`

## 公告

开始时宣布："我正在使用 writing-plans skill 创建实现计划。"

## 输出路径

- 主文件保存到 `specs/<date+feature>/plan.md`（摘要 + Task 概览）
- 每个 task 保存到 `specs/<date+feature>/tasks/T1.md`、`T2.md`、...（独立 task 文件）

**上下文：** 如果在隔离 worktree 中工作，它应该已经通过 `loom-using-git-worktrees` skill 在执行时创建。

## 范围检查

如果 spec 涵盖多个独立子系统，它应该在 brainstorming 期间被分解为子项目 spec。如果没有，建议分解为单独的计划 — 每个子系统一个。每个计划应该产生可工作、可测试的独立软件。

## 执行流程

### Step 1：读取 spec

读取 `specs/<date+feature>/spec.md`，提取所有功能点、接口定义、数据模型。

### Step 2：读取项目约束

1. 读取 `.loom/rules/constitution.md`（宪章）
2. 读取 `.loom/rules/project-structure.md`（工程结构）
3. 如果存在 `.loom/contexts/subagent-context.md`，读取它用于后续 task 上下文

### Step 3：文件结构

在定义 task 之前，先规划哪些文件将被创建或修改以及每个文件的职责。这是锁定分解决策的地方。

- 设计具有清晰边界和良好定义接口的单位。每个文件应该有一个明确的职责。
- 你最容易推理的是你可以一次性放入上下文的代码，当文件专注时，你的编辑更可靠。优先选择小的、专注的文件，而不是做太多的大文件。
- 一起变化的文件应该放在一起。按职责拆分，而不是按技术层拆分。
- 在现有代码库中，遵循既定模式。如果代码库使用大文件，不要单方面重组 — 但如果你正在修改的文件已经变得难以处理，在计划中包含一个拆分是合理的。

这种结构通知 task 分解。每个 task 应该产生可以独立理解的更改。

### Step 4：按依赖顺序拆分 task（Bite-Sized 粒度）

**读取 `.loom/rules/project-structure.md` 中定义的架构分层，按项目的实际依赖顺序拆分 task。**

不同项目架构不同（MVC、分层、六边形、Clean Architecture、前端组件树等）。不要硬编码层级名称，而是从 project-structure.md 中提取项目的实际分层，按依赖顺序（底层→上层）排列。

**通用依赖顺序原则：**

- 数据/模型定义 → 业务逻辑 → 接口/UI → 路由/配置 → 集成/胶水
- 没有依赖的 task 先做
- 有循环依赖的 task 拆开或合并

**每个步骤是一个可独立验证的交付物（一个文件或一个功能点）：**

- "创建数据模型并编写测试" - 步骤
- "实现服务层方法并编写测试" - 步骤
- "创建 API 接口并编写测试" - 步骤

### Step 5：为每个 task 编写详细内容

**plan.md 只包含摘要和 Task 概览，每个 task 的详细内容写入独立文件。**

**plan.md 必须以这个 header 开头：**

```markdown
# [功能名称] 实现计划

**目标：** [一句话描述构建什么]

**架构：** [关于方法的 2-3 句话]

**技术栈：** [关键技术/库]

---

## Task 概览

| Task | 名称         | 层级   | 复杂度 | 依赖 | 文件          |
| ---- | ------------ | ------ | ------ | ---- | ------------- |
| T1   | <功能点名称> | <层级> | 简单   | 无   | `tasks/T1.md` |
| T2   | <功能点名称> | <层级> | 中等   | T1   | `tasks/T2.md` |
| ...  | ...          | ...    | ...    | ...  | ...           |

## 依赖关系

T1 → T2 → T3 → ...
```

**每个 task 文件（`tasks/TN.md`）必须包含以下全部字段，禁止省略：**

````markdown
### Task N: <功能点名称>

- **层级**: 从 `.loom/rules/project-structure.md` 中提取的项目分层名称
- **复杂度**: 简单 / 中等 / 复杂
- **依赖**: Task X, Task Y（无则写"无"）
- **涉及文件**:
  - 创建: `path/to/new/file.<ext>`
  - 修改: `path/to/existing/file.<ext>:123-145`
  - 测试: `tests/path/to/test.<ext>`

- [ ] **步骤 1：写失败的测试**

```language
def test_specific_behavior():
    result = function(input)
    assert result == expected
```

- [ ] **步骤 2：运行测试验证失败**

运行测试用例
预期：FAIL，显示 "function not defined"

- [ ] **步骤 3：写最小实现**

```language
def function(input):
    return expected
```

- [ ] **步骤 4：运行测试验证通过**

运行测试用例
预期：PASS
````

### Step 6：检查清单（No Placeholders）

输出 plan 后，自检：

<!-- loom:generate:rule:placeholder-scan-ban -->
**占位符扫描禁止**

禁止使用以下占位符，发现即视为未完成：TBD、TODO、implement later、fill in details、Similar to Task N、"add appropriate error handling"
<!-- /loom:generate:rule:placeholder-scan-ban -->

**其他检查项：**

- [ ] plan.md 包含摘要和 Task 概览表
- [ ] 每个 task 文件（tasks/TN.md）包含完整的步骤和代码示例
- [ ] 所有 task 的依赖关系无循环
- [ ] 每个 task 可独立编译验证
- [ ] 代码示例可直接复制运行（无占位符）
- [ ] 分层顺序正确（按 project-structure.md 定义的依赖顺序，从底层到上层）
- [ ] 遵守编码红线（读取 constitution.md，无违反）
- [ ] 类型一致性：后面 task 中使用的类型、方法签名和属性名与你早期 task 中定义的匹配

## 模型选择策略

<!-- loom:generate:model-selection -->
## 模型选择策略

使用最强大的模型来处理每个角色，以节省成本并提高效率：

**机械实现任务**（隔离函数、清晰规范、1-2 个文件）：使用快速、便宜的模型。当计划明确时，大多数实现任务都是机械的

**集成和判断任务**（多文件协调、模式匹配、调试）：使用标准模型

**架构、设计和审查任务**：使用可用的最强模型

**任务复杂度信号：**

- 触及 1-2 个文件且有完整规范 → 便宜模型
- 触及多个文件且有集成问题 → 标准模型
- 需要设计判断或广泛的代码库理解 → 最强模型
<!-- /loom:generate:model-selection -->

## 编码红线（task 中绝对禁止）

**读取 `.loom/rules/constitution.md` 中的编码红线，以下为通用红线（项目宪章有额外条目时以宪章为准）：**

1. 跨层写逻辑（如在展示层写业务逻辑、在数据层写展示逻辑）
2. 使用语言默认的调试打印——必须用项目日志组件
3. 硬编码配置值（密码、密钥、URL）
4. 不安全的字符串拼接（SQL、命令、HTML 等——必须用参数化/转义）
5. 修改自动生成的代码文件
6. 修改不应手动编辑的框架/工具生成文件

## 技术上下文（task 中必须参考）

从`.loom/rules/constitution.md`和`.loom/rules/project-structure.md`中提取——不同项目关注点不同，按实际提取：

**通用关注点：**

- **测试基础设施**：如何编写和运行测试
- **错误处理**：项目统一错误处理方式
- **日志**：日志使用方式
- **配置**：配置管理方式

**按项目类型可能存在的关注点：**

- **接口/响应格式**：API 项目有统一响应格式
- **路由**：Web 项目有路由注册规范
- **缓存**：有缓存策略的项目
- **分页**：有分页查询需求的项目

## 流程图

```
读取spec → 读取项目约束 → 规划文件结构 → 按分层拆分task → 编写task详细内容 → 检查清单
                                                                      │
                                              推荐路径 → subagent-dev
                                              备选路径 → executing-plans
```

## progress.md 更新

**开始执行时**：更新 `specs/<date+feature>/progress.md`，将 Step 2 状态设为 `▶ 进行中`，**开始时间填写当前时间（HH:mm 格式，如 14:30）**；在 Skill 调用记录中追加一行，时间列填写当前时间。

**执行完成时**：将 Step 2 状态更新为 `✅ 完成`，**完成时间填写当前时间（HH:mm 格式）**；在 Skill 调用记录中更新对应行结果为 `✅ 已完成`，时间列填写完成时的时间。

**关键：时间必须填入实际的 HH:mm 数值（如 14:30），禁止填入字面量 "HH:mm"。**

## 完成条件与下一步

plan.md 和所有 task 文件（tasks/T1.md, T2.md, ...）保存并自检完毕后，必须同时更新 `specs/<date+feature>/progress.md`（按上述规则填写完成时间），**等待用户确认 plan**。

用户确认后，**完成后：遵循 `.loom/workflow.yaml` 继续下一步**。
