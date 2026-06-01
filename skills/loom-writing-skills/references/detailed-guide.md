# Skill 编写详细指南

## References 文件

如果 skill 需要大量参考信息，放在 `references/` 目录：

- 保持 SKILL.md 精简
- `references/` 包含详细检查清单、模板、示例
- 在 SKILL.md 中引用 `references` 文件

常用 `references` 文件：

- `visual-companion.md` - 可视化伴侣详细指南
- `testing-anti-patterns.md` - 测试反模式
- `common-excuses.md` - 常见借口对照表
- `design-checklist.md` - 设计自检清单

## Scripts / Assets / Evals

优先把确定性的检查、生成、格式转换放进脚本，不要让 agent 按长篇自然语言重复执行。

推荐结构：

```text
skills/<skill-name>/
  SKILL.md
  scripts/
  references/
  assets/
  evals/triggers.json
```

`evals/triggers.json` 用来记录触发边界：

```json
{
  "version": 1,
  "skill": "loom-example",
  "positive": [{ "prompt": "应该触发的用户话术", "reason": "为什么" }],
  "negative": [{ "prompt": "不该触发的用户话术", "reason": "为什么" }]
}
```

每次新增或修改 skill 后运行：

```bash
npm run test:skills
```

## 测试新 Skill

核心：TDD for Skills。

1. 不用 skill 时跑一遍，记录失败模式。
2. 写最少的 skill 内容让 agent 不再犯同类错误。
3. 通过重测发现漏洞，继续修补。
4. 验证触发条件是否正确。
5. 验证是否包含必要的方法论元素、检查清单和完成条件。

## 常见 Anti-Pattern

- 一个 skill 做多件事，违反单一职责。
- 触发条件太宽或太窄。
- 步骤描述模糊，只写"处理错误"而不说明如何检查返回码。
- 没有完成条件，不知道何时算完成。
- 不与其他 skill 串联，不知道何时触发下一步。
