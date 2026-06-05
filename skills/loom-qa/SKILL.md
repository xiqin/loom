---
name: loom-qa
description: >
  QA 验收流水线编排器：从需求变更分析到功能测试、回归测试、集成测试，
  维护持久化测试用例库，输出 qa-report.md。
  Use when: 测试人员对新功能或 release 进行验收测试，需要完整的功能测试覆盖。
---

# QA 验收流水线

## 定位

这是**测试人员**使用的流水线，与开发流水线完全独立。运行于功能开发完成后，目标是：

1. 验证新功能符合 spec 描述
2. 确认改动未破坏现有功能（回归）
3. 验证模块间集成正确
4. 维护持久化测试用例库（`.loom/qa-suite/`），功能变更时同步更新用例

## 流水线阶段

QA 流水线（`pipeline_type: qa`）有 6 个阶段，每个阶段对应本 skill 的不同职责：

| 阶段 | 职责 | 使用子 prompt |
|------|------|-------------|
| `qa-analysis` | 分析变更范围，确定测试矩阵 | `qa-analyst-prompt.md` |
| `qa-design` | 生成/更新用例，旧用例转 deprecated | `qa-designer-prompt.md` |
| `qa-approved` | human-approval gate（自动） | — |
| `qa-execution` | 跑自动化测试，生成手动 checklist | `qa-executor-prompt.md` |
| `qa-signoff` | human-approval gate，测试人员签字 | — |
| `qa-report` | 汇总 → qa-report.md | `qa-reporter-prompt.md` |

## 执行规则

1. 进入每个阶段前，读取对应子 prompt 文件（路径见下方）
2. qa 战役目录：`qa/<date+target>/`（不复用 `specs/`）
3. 用例库：`.loom/qa-suite/`，进版本控制，随功能迭代更新
4. verdict 三态：`PASS`（全绿）/ `PARTIAL`（自动绿但手动有遗留）/ `FAIL`（有测试失败）
5. CI 门禁：`loom run --spec-dir qa/<target> --verdict`，exit 0=PASS，1=FAIL，2=PARTIAL

## 触发方式

```bash
# 初始化 qa 战役
loom run --type qa --spec-dir qa/$(date +%Y-%m-%d)+<target>

# 推进各阶段
loom run --spec-dir qa/<target> --advance

# 人工审批节点
loom run --spec-dir qa/<target> --approve

# CI 门禁查询
loom run --spec-dir qa/<target> --verdict
```

## 子 prompt 路径

- `references/qa-analyst-prompt.md`
- `references/qa-designer-prompt.md`
- `references/qa-executor-prompt.md`
- `references/qa-reporter-prompt.md`
