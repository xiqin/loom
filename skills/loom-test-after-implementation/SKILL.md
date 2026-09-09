---
name: loom-test-after-implementation
description: >
  Implement features first, then write behavior-verification tests against the real public API.
  Code-first/test-after cycle: implement → refactor → write behavior tests → run tests.
  Use when: implementing behavior where tests verify outcomes after production code is written.
when_to_use: Implement behavior through a code-first/test-after loop with mandatory refactor before testing.
argument-hint: <behavior or test seam>
user-invocable: true
---

# 实现后测试（Test-After Implementation）

## 核心循环

```text
实现（Implement）→ 重构（Refactor）→ 测试（Test）→ 验证（Verify）
```

1. **实现**：按 task 定义编写生产代码，实现当前行为。
2. **重构**：在写测试前先清理代码结构——消除重复、改善命名、理清职责。测试会随后锁定这个结构，因此必须先让它值得锁定。
3. **测试**：针对实现的 public boundary 写行为验证测试。
4. **验证**：运行测试，确认全部通过；用覆盖率工具找出未测试区域并判断是否需要补测。

## 铁律

- 先实现，再重构，最后写测试——测试依据真实 public API，而非臆想的接口。
- 测试文件必须持久化到项目标准测试目录，不得作为临时验证后删除。
- 写测试前必须确认 seam：测试要通过哪个 public boundary 验证行为。
- 重构是强制步骤，不是可选步骤。跳过重构直接写测试，会把凌乱实现锁死在测试里。

## 设计原则

本 skill 采用“实现 → 重构 → 行为测试 → 验证”流程，不要求测试代码先于生产代码。

先根据真实业务需求完成最小实现，并在测试前整理设计。随后针对稳定的 public API 编写行为级测试，验证用户可观察的结果、边界、异常和副作用。

测试不得成为引入生产抽象的理由。除外部网络或计费 API、不可回滚副作用、不可控非确定性外，优先使用真实依赖，不为测试增加构造参数、接口或测试专用方法。

## 使用场景

默认用于新功能、bug 修复、重构和行为变更。一次性原型、生成代码或纯配置变更可以先询问用户是否例外。

## 执行流程

当前 task 的需求产物必须从 `specs/<date+feature>/` 读取；不要在项目根目录读取或生成 `spec.md`、`plan.md`、`tasks/` 等 loom 阶段产物。

### Step 1：理解需求

读取 `specs/<date+feature>/spec.md`、`specs/<date+feature>/plan.md` 和当前 `specs/<date+feature>/tasks/TN.md`，明确当前 task 的实现范围和测试范围。

### Step 2：确认业务行为边界

从已批准的 spec、plan 和 task 中确认实现范围、用户可观察行为以及适用的异常和边界条件。

此步骤只确认业务边界，不设计测试隔离点、不预设依赖替换方式，也不要求先写测试。public boundary 只作为业务入口记录，具体测试 seam 在实现和重构完成后确认。

### Step 3：实现

1. 按 task 中的实现步骤编写生产代码。
2. 只实现 task frontmatter 中列出的 Requirement ID 与 `behavior_ids`，不超出 spec 范围。
3. 运行项目约定的构建命令确认编译通过。

### Step 4：测试前设计审查与重构

在写测试前重构。这是强制步骤。

1. 检查新增参数、接口、抽象和扩展点是否有独立的业务理由；只服务测试的设计必须删除或延后。
2. 通用策略、插件或业务抽象必须能指出至少两个真实生产场景；外部网络/计费 API、不可回滚副作用、不可控非确定性这三种允许注入边界可以只有一个生产实现，但必须说明替换边界和业务理由。其他单一场景应优先使用具体实现，而不是只为 mock、替换依赖或隔离测试引入抽象。
3. 消除重复、改善命名、理清职责边界。
4. 不为可测试性而改动设计——不为注入拆接口、不为 mock 加构造参数、不为隔离建薄壳转发类。
5. 运行构建命令确认重构未破坏编译。

### Step 5：确认测试 seam

在实现和重构完成后，列出候选 seam，并说明每个 seam 对应的 public boundary，例如 CLI 命令、HTTP API、组件交互、公开函数、持久化副作用或事件输出。

必须向用户或当前已批准 spec/plan 对齐以下内容：

1. 选择哪个 seam。
2. 该 seam 验证的用户可观察行为是什么。
3. 为什么不测试内部实现细节。

未确认 seam 时，不得写测试。若用户不在场且 spec/plan 已明确 public boundary，可基于已批准产物确认 seam，并在输出中记录依据。

### Step 6：测试

1. 针对已确认的 seam 和已实现的 public API 写行为验证测试。
2. 测试层级：**行为级/集成测试优先，真实依赖**——文件 I/O 用 `mkdtempSync` 真实临时目录 + afterEach 清理，单元测试仅作为行为级触达不到的纯逻辑分支的补充。
3. 仅三种边界允许注入替换，且用内联 fake 对象、不为测试建实现类：
   - a) 外部网络/计费 API
   - b) 不可回滚副作用（邮件/支付）
   - c) 不可控非确定性（如 crypto.random）
4. **禁止为测试目的给生产代码添加构造参数/接口/仅测试方法**（test-induced design damage）；若唯一动机是"测试时不碰磁盘"，用 mkdtempSync。
5. 每个测试只验证一个行为。
6. 测试文件持久化到项目标准测试目录。

### Step 7：验证

1. 运行项目约定的测试命令，确认全部通过。
2. 运行覆盖率工具（如可用），查看未测试区域。覆盖率是发现工具而非门槛——关注"哪些行为没被测到"，不追求特定百分比。
3. 对未测试区域判断：该行为是否有独立可错路径？有则补测；无（如纯转发或框架生成的胶水代码）则记录判断依据。
4. 更新 `specs/<date+feature>/traceability.json`：每个 `behavior_ids` 至少对应一个持久化行为验证测试，写入 behavior 级 `tests` 与 `evidence` 引用。

### Step 8：重复

对下一个行为点重复实现→重构→测试→验证。

## 测试规范

- 名称描述真实行为。
- 一个测试验证一件事。
- 结构遵循 Arrange / Act / Assert。
- 覆盖正常流程、异常流程和边界条件。
- 默认测试真实代码，仅在不可避免时 mock。
- 通过 public seam 验证行为，不绑定私有函数、内部状态或实现顺序。

示例、理由和反模式见：

- `references/examples-and-rationale.md`
- `references/testing-anti-patterns.md`
- `references/common-pitfalls.md`

## 红旗

- 跳过重构直接写测试（测试会锁死凌乱实现）。
- 为可测试性给生产代码加构造参数/接口/仅测试方法。
- 测试绑定内部实现细节而非 public boundary。
- 无法解释测试 seam。
- 依赖手动测试替代自动测试。
- 覆盖率达标但未检查未测试区域是否真有可错路径。
- 想保留未测试的"探索代码"作为参考。

出现红旗时，先补齐重构或测试，再继续。

## 完成清单

- [ ] 每个新行为都有测试。
- [ ] 每个测试都有明确 seam，且 seam 是 public boundary。
- [ ] 新增生产抽象都有独立的业务理由，不是测试隔离产物。
- [ ] 实现在写测试前已重构。
- [ ] 所有相关测试通过。
- [ ] 覆盖率未测试区域已逐项判断并记录。
- [ ] 测试文件持久化在项目标准测试目录。
- [ ] `traceability.json` 的 behavior 级 `tests` 与 `evidence` 已更新。
- [ ] 输出干净，无新增错误或警告。

## 最终规则

```text
实现先行 -> 重构 -> 测试验证真实 public API
否则 -> 没有验证的实现
```
