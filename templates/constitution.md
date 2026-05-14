# 项目宪章

> 本文件由 `/loom-init-project` 自动生成，请根据项目实际情况完善。

## 编码行为准则

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

### 第一步：需求设计（brainstorming）→ 产出 `specs/<date+feature>/spec.md`，用户确认后继续

### 第二步：计划拆解（writing-plans）→ 产出 `specs/<date+feature>/plan.md`，用户确认后继续

### 第三步：环境隔离（git-worktree）→ 创建 `feature/<date>-<feature>` 隔离分支

### 第四步：编码执行（subagent-dev）→ Subagent 隔离派发 + 双审查

### 第五步：完成前验证（verification）→ Spec 覆盖/类型一致性/编译测试

### 第六步：索引更新（index-update）→ 同步工程索引

**严令禁止跳过任何步骤。每个步骤完成后必须显式触发下一步，不可自行终止。**
**每个 skill 执行完毕后，必须读取自身的"完成条件与下一步"节并严格遵守。跳过串联视为严重错误。**

## progress.md 追踪文件

维护 `specs/<date+feature>/progress.md`，格式：

| Step | 阶段          | 状态 | 开始时间 | 完成时间 | 备注 |
| ---- | ------------- | ---- | -------- | -------- | ---- |
| 1    | brainstorming | ✅   | <当前时间 HH:mm> | <当前时间 HH:mm> |      |

更新规则：开始→▶进行中+填写开始时间，完成→✅+填写完成时间，失败→❌+填写完成时间+原因。**时间必须填入实际的 HH:mm 数值（如 14:30），禁止填入字面量 "HH:mm"。**

## 治理规则

本章程高于所有其他开发规范。

- 修订章程必须记录变更内容、获得审批。
- 所有合并请求必须验证是否符合本章程。
