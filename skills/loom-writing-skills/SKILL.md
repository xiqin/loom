---
name: loom-writing-skills
description: >
  Author or modify a loom skill file. Provides SKILL.md structure, frontmatter format, and quality checklist.
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

## 参考与测试

详细的 references 结构、scripts/evals 写法、测试方法和常见反模式见 `references/detailed-guide.md`。
