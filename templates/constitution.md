# 项目宪章

> 本文件由 `/loom-init-project` 自动生成，请根据项目实际情况完善。

## 编码行为准则

> 源自 Andrej Karpathy 的 LLM 编码原则，是所有 AI 产出代码的底层纪律。

### 1. 先思考，再编码

- 显式声明你的假设，不确定时主动提问
- 当存在多种合理解读时，列举所有可能性，不要默默选择一种
- 如果有更简单的方案，必须提出

### 2. 极简优先

- 只写解决问题的最小代码，不做推测性实现
- 不添加用户未要求的功能、配置项或抽象层
- 判断标准：一个高级工程师看了会不会觉得过度设计？

### 3. 精准手术

- 只改动必须改动的部分，不"顺便优化"相邻代码
- 保持现有代码风格，除非用户明确要求改变
- 清理范围仅限于自己改动产生的孤代码

### 4. 目标驱动

- 将模糊任务转化为可验证的成功标准
- 制定多步验证计划，循环执行直到达标
- 不声称"完成"，除非验证通过

## 核心原则

1. **{{ARCH_PRINCIPLE}}**：{{ARCH_DESC}}
2. **{{DI_PRINCIPLE}}**：{{DI_DESC}}
3. **{{CONFIG_PRINCIPLE}}**：{{CONFIG_DESC}}
4. **{{ERROR_PRINCIPLE}}**：{{ERROR_DESC}}
5. **{{CODEGEN_PRINCIPLE}}**：{{CODEGEN_DESC}}

## 技术栈

| 技术              | 版本                  | 用途     |
| ----------------- | --------------------- | -------- |
| {{LANGUAGE}}      | {{LANGUAGE_VERSION}}  | 编程语言 |
| {{WEB_FRAMEWORK}} | {{FRAMEWORK_VERSION}} | Web 框架 |
| {{ORM}}           | {{ORM_VERSION}}       | ORM      |
| {{DATABASE}}      | {{DATABASE_VERSION}}  | 数据库   |
| {{CACHE}}         | {{CACHE_VERSION}}     | 缓存     |
| {{LOGGING}}       | {{LOGGING_VERSION}}   | 日志     |
| {{DI}}            | {{DI_VERSION}}        | 依赖注入 |

## 编码红线

> 以下红线为自动生成，请确认并补充。

{{CODING_REDLINES}}

## 项目约束

- 语言版本：{{LANGUAGE_VERSION}}
- 必须通过：{{BUILD_CMD}}
- 必须通过：{{VET_CMD}}
- 测试命令：{{TEST_CMD}}

## 开发流程（硬性约束 · 必须严格执行）

**任何新增功能或接口，必须严格按以下顺序执行，不可跳过、不可合并步骤：**

本项目使用 loom (loom-engineering) 插件。

```
brainstorming → writing-plans → git-worktree → subagent-dev → verification → index-update
```

### 第一步：需求设计（brainstorming）

- 头脑风暴设计方案
- 产出 `specs/<date+feature>/spec.md`
- 用户确认 spec 后方可进入下一步

### 第二步：计划拆解（writing-plans）

- **硬性前置条件**：`specs/<date+feature>/spec.md` 必须存在
- **如果不存在，必须停止，提示用户先执行第一步**
- 按分层拆分 task
- 产出 `specs/<date+feature>/plan.md`
- 用户确认 spec 后方可进入下一步

### 第三步：环境隔离（git-worktree）

- 创建`feature/<date+feature>`隔离分支

### 第四步：编码执行（subagent-dev）

- **硬性前置条件**：`specs/<date+feature>/spec.md`,`specs/<date+feature>/plan.md` 必须存在，git worktree 已创建
- **如果不存在，必须停止，提示用户先执行前三步**
- Subagent 隔离派发 + 双审查

### 第五步：索引更新（index-update）

- 同步工程索引
- 索引内容必须与实际代码一致

**严令禁止跳过任何步骤。每个步骤完成后必须显式触发下一步，不可自行终止。**
**每个 skill 执行完毕后，必须读取自身的"完成条件与下一步"节并严格遵守。跳过串联视为严重错误。**

## progress.md 追踪文件

每个功能开发过程中，必须维护 `specs/<date+feature>/progress.md`，格式如下：

```markdown
# <feature> — 开发流水线

**开始时间：** YYYY-MM-DD HH:mm
**当前阶段：** Step N/5

| Step | 阶段          | 状态     | 开始时间 | 完成时间 | 备注              |
| ---- | ------------- | -------- | -------- | -------- | ----------------- |
| 1    | brainstorming | ✅ 完成  | HH:mm    | HH:mm    |                   |
| 2    | writing-plans | ✅ 完成  | HH:mm    | HH:mm    |                   |
| 3    | git-worktree  | ✅ 完成  | HH:mm    | HH:mm    | 分支: feature/xxx |
| 4    | subagent-dev  | ▶ 进行中 | HH:mm    | —        | task 3/8          |
| 5    | index-update  | ⏳ 等待  | —        | —        |                   |

[//]: # "| 6 | 提交 | ⏳ 等待 | — | — | |"

## Skill 调用记录

| 时间  | Skill         | 触发原因              | 结果      |
| ----- | ------------- | --------------------- | --------- |
| HH:mm | brainstorming | 用户提出需求          | ✅ 已完成 |
| HH:mm | writing-plans | 设计确认，开始拆 plan | ✅ 已完成 |
| HH:mm | subagent-dev  | plan 确认，开始编码   | ▶ 执行中  |
```

**更新规则：**

- 每个 skill 开始执行时：更新对应行状态为 `▶ 进行中`，填写开始时间
- 每个 skill 执行结束时：更新状态为 `✅ 完成`，填写完成时间
- 在 Skill 调用记录中追加一行
- 如果某步骤失败：状态改为 `❌ 失败`，备注写失败原因

## 治理规则

本章程高于所有其他开发规范。

- 修订章程必须记录变更内容、获得审批。
- 所有合并请求必须验证是否符合本章程。
