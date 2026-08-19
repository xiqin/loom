---
owns: []        # 此 task 独占写入的文件/目录（用于并行冲突检测）
                # 例: [src/auth/, src/middleware/auth.ts]
reads: []       # 此 task 只读依赖的文件/目录（不会写入）
                # 例: [src/types/user.ts, config/]
depends_on: []  # 前置 task（必须在这些 task 完成后才能执行）
                # 例: [T1, T2]
requirements: [] # 本 task 覆盖的 spec Requirement ID；不得为空
                 # 例: [REQ-001, REQ-003]
behavior_ids: [] # 本 task 覆盖的 requirements.json behavior ID；不得为空
                 # 例: [REQ-001-B01, REQ-001-B02]
complexity: medium  # low | medium | high（影响模型选择策略）
---

# Task N: <任务名称>

## 描述

<一句话描述此 task 的目标>

## 依赖

- 前置 task：<T1, T2 或 无>
- 外部依赖：<第三方库或服务，或 无>

## 涉及文件

| 操作 | 文件路径 | 说明 |
|------|----------|------|
| 创建 | `<path>` | <说明> |
| 修改 | `<path>` | <说明> |

## 复杂度

<low / medium / high>，原因：<一句话说明>

## 实现步骤

- [ ] 步骤 1：<具体操作>
- [ ] 步骤 2：<具体操作>
- [ ] 步骤 3：<具体操作>

## 验收映射

| Requirement ID | Behavior ID | 验收标准 | 代码位置 | 测试用例 |
| -------------- | ----------- | -------- | -------- | -------- |
| REQ-001 | REQ-001-B01 | <从 requirements.json 精确提取> | `<path>:<symbol>` | `<test name>` |

## Traceability 更新要求

- planning 阶段：把本 task 的 `requirements` 和 `behavior_ids` 写入 `traceability.json` 的 `tasks` 字段。
- executing 阶段：补齐对应 behavior 的 `tests` 和 `evidence` 引用。
- 不允许只映射到 REQ 而遗漏 behavior 级映射。

## TDD 步骤（行为级红绿循环）

- [ ] 写失败的行为测试：<测试文件路径> — <测试场景>；**真实依赖**（文件 I/O 用 `mkdtempSync` 临时目录），不为测试给生产代码注入构造参数/接口
- [ ] 运行确认失败：`<test command>`（"红"是硬要求，证明测试非伪测试）
- [ ] 实现通过测试
- [ ] 重构（如需要）
- [ ] （可选）补充单元测试：仅覆盖行为级测试触达不到的纯逻辑分支；依赖注入仅限三边界（外部网络/计费 API、不可回滚副作用、不可控非确定性），用内联 fake 对象、不建实现类

## 测试说明

- 测试文件：`<路径>`（持久化到标准测试目录）
- 测试层级：<行为级 / 集成 / 单元（选单元须说明为何下沉）>
- 覆盖场景：<成功路径、边界条件、错误路径>
- 验证命令：`<BUILD_CMD>` / `<VET_CMD>` / `<TEST_CMD>`

## 完成标准

- [ ] 所有步骤完成
- [ ] 测试通过
- [ ] 无占位符残留（TBD / TODO / implement later）
