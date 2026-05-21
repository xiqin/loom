# Subagent 执行细节

## 使用机制

每个 task 派发 fresh subagent，上下文互不继承。

```text
首次实现:
  Task N -> implementer(完整 task + spec + subagent-context) -> reviewer -> PASS/FAIL

修复:
  reviewer/test-reporter/verification FAIL
  -> 提取修复指令
  -> implementer(修复指令 + subagent-context)
  -> 重新审查或重验
```

修复模式只传递修复指令和 `.loom/contexts/subagent-context.md`，不重新传递完整 task 定义和 spec 全文。

## Implementer 状态处理

- **DONE**：继续合并审查。
- **DONE_WITH_CONCERNS**：先读疑虑。正确性或范围疑虑需先解决；观察类疑虑记录后继续审查。
- **NEEDS_CONTEXT**：提供缺失上下文并重新派发。
- **BLOCKED**：判断 blocker 是上下文不足、模型能力不足、task 太大还是计划错误；分别补上下文、换强模型、拆 task 或上报用户。

不要忽略升级，也不要在没有任何改变时强制重试。

## 执行循环

```text
读取 plan -> 对每个 task:
  派发 implementer(首次实现)
  -> 派发 combined reviewer
  -> reviewer FAIL 时提取修复指令并派发 implementer(修复模式)
  -> reviewer PASS 后进入下一个 task
全部 task PASS:
  派发 test-reporter
  -> 编写集成测试、运行回归测试、对照 spec 验证、输出 test-report.md
  -> FAIL 时提取修复指令并派发 implementer(修复模式)
```

test-reporter 派发前不要自行替代它运行完整编译和测试；主 agent 只在报告完成后复核关键证据。

## 红线

- 禁止在未批准 spec、未确认 plan 前开始实现。
- 禁止跳过审查循环。
- 禁止默认并行派发多个实现 subagent；需要并行时使用 `loom-dispatching-parallel-agents` 并确认无依赖和文件冲突。
- 禁止接受 spec 合规的"足够接近"。
- 禁止让实现者自检替代 reviewer 审查。
- 禁止将测试文件作为临时验证后删除。
- 禁止跳过集成测试和回归测试。

## Prompt 模板

派发前读取并填充：

- `implementer-prompt.md`
- `combined-reviewer-prompt.md`
- `test-reporter-prompt.md`

禁止手写简化 prompt 绕过模板。
