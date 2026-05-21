---
name: loom-writing-skills
description: >
  编写新 skill。创建自定义 skill 文件。
  Use when: creating a new skill or modifying existing skills.
  Trigger keywords: 写 skill, 创建技能, 新技能, 自定义 skill.
---

# 编写新 Skill

## Skill 文件结构

```text
skills/
  <skill-name>/
    SKILL.md          # 必需：skill 主文件
    references/       # 可选：参考文件
      *.md
    scripts/          # 可选：可执行检查、生成器、转换器
    assets/           # 可选：模板、prompt 片段、示例输入输出
    evals/            # 可选：触发边界样例
```

## SKILL.md 格式

````markdown
---
name: loom-<skill-name>
description: >
  简短描述。说明何时使用此 skill。
  Use when: <触发条件描述>.
  Trigger keywords: <关键词列表>.
---

# <Skill 标题>

## 触发条件

- 用户说 xxx 时触发
- 在 xxx 流程中自动触发

## 执行流程

### Step 1: ...
### Step 2: ...

## 约束

- 规则 1
- 规则 2

## 完成条件与下一步

完成后继续。
````

## Frontmatter 字段

| 字段 | 必需 | 说明 |
| ---- | ---- | ---- |
| name | 是 | skill 名称，必须与目录名一致 |
| description | 是 | 简短描述，用于 Skill 工具选择 |

## 编写原则

| 正确做法 | 反模式 |
| --- | --- |
| 单一职责 | 一个 skill 做多件事 |
| 清晰触发条件 | 触发太宽或太窄 |
| 完整执行流程 | 步骤描述模糊 |
| 可中断、可链式 | 缺少完成条件或不串联 |
| 有必要的自检清单 | 输出质量不可验证 |

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
- 步骤描述模糊，只写“处理错误”而不说明如何检查返回码。
- 没有完成条件，不知道何时算完成。
- 不与其他 skill 串联，不知道何时触发下一步。

## 流程图

```text
确定目的 → 编写 SKILL.md → 添加清单 → 添加 references → 测试
                                      └→ 失败 → 修改 SKILL.md（循环）
```
