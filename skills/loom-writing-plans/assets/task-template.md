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

| Requirement ID | Behavior ID | 验收标准 | 代码位置 | 验证场景 |
| -------------- | ----------- | -------- | -------- | -------- |
| REQ-001 | REQ-001-B01 | <从 requirements.json 精确提取> | `<path>:<symbol>` | `<实现后补充行为验证场景>` |

## Traceability 更新要求

- planning 阶段：把本 task 的 `requirements` 和 `behavior_ids` 写入 `traceability.json` 的 `tasks` 字段。
- executing 阶段：补齐对应 behavior 的 `tests` 和 `evidence` 引用。
- planning 阶段只填写可观察的验证场景，不预先设计具体测试文件、测试名称或隔离方式；这些内容在实现、重构并确认 seam 后补充。
- 不允许只映射到 REQ 而遗漏 behavior 级映射。

## 测试步骤（实现后行为验证）

- [ ] 确认上方"实现步骤"已全部完成且编译通过
- [ ] 重构（强制）：消除重复、改善命名、理清职责；**不为可测试性改动设计**（不注入构造参数/接口/薄壳转发）
- [ ] 测试前设计审查：新增参数、接口、抽象或扩展点必须有业务理由；通用策略、插件或业务抽象至少对应两个真实生产场景，并记录审查结论
- [ ] 写行为验证测试：`<测试文件路径>` — <测试场景>；**真实依赖**（文件 I/O 用 `mkdtempSync` 临时目录），不为测试给生产代码注入构造参数/接口
- [ ] 运行测试确认通过：`<test command>`
- [ ] 查看覆盖率未测区域，逐项判断是否有独立可错路径；有则补测，无则记录依据
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
