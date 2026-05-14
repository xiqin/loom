---
name: loom-index-update
description: >
  完成工作后更新索引文件。测试通过后触发，确保工程索引、记忆文件、入口文档与代码保持同步。
  Use when: code changes are complete and indexes need to be synchronized.
  Trigger keywords: 更新索引, 同步索引, 更新文档, index update
---

# 索引更新 Skill

## 触发条件

- 功能测试通过后自动触发
- 用户手动触发："更新索引""同步索引""更新文档"

## 前置条件

1. 代码变更已完成（subagent-driven-development 全部通过）
2. verification-before-completion 已通过
3. 或用户明确要求更新索引

## 状态输出

- 开始：`▶ pipeline [■■■■■■] Step 6/6 — 索引更新 (index-update) | status: 开始`
- 完成：`✅ pipeline [■■■■■■] Step 6/6 — 索引更新 | 完成 | → 工作完成，可以提交`
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  pipeline [■■■■■■] Step 6/6 — 索引更新 (index-update)
  skill: index-update
  status: ▶ 开始执行
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```

执行结束时：

```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
pipeline [■■■■■■] Step 6/6 — 索引更新 (index-update)
status: ✅ 完成
下一步: → 工作完成，可以提交
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

````

## progress.md 更新

**开始执行时**：更新 `specs/<date+feature>/progress.md`，将 Step 6 状态设为 `▶ 进行中`，**开始时间填写当前时间（HH:mm 格式，如 14:30）**；在 Skill 调用记录中追加一行，时间列填写当前时间。

**执行完成时**：将 Step 6 状态更新为 `✅ 完成`，**完成时间填写当前时间（HH:mm 格式）**；在 Skill 调用记录中更新对应行结果为 `✅ 已完成`，时间列填写完成时的时间。

**关键：时间必须填入实际的 HH:mm 数值（如 14:30），禁止填入字面量 "HH:mm"。**

同时更新 `specs/<date+feature>/progress.md`。

## 执行流程

### Step 1: 检测变更范围 + 检测 graphify

1. 运行 `git diff --name-only HEAD` 确认本次变更涉及的文件
2. 分析变更类型，按 `REFERENCE/update-checklist.md` 确定需要更新的文件
3. 检测 graphify 是否可用：

```powershell
python -c "import graphify" 2>$null
if ($LASTEXITCODE -eq 0) {
    # graphify 可用，检查图谱是否已存在
    if (Test-Path "graphify-out/graph.json") {
        $graphifyMode = "update"   # 增量更新
    } else {
        $graphifyMode = "build"    # 首次构建
    }
} else {
    $graphifyMode = "unavailable" # 不可用，走手动索引
}
```

记录 `$graphifyMode` 的值，Step 2 根据它走不同路径。

### Step 2: 更新工程结构索引（条件分支）

#### 路径 A：graphify 可用（$graphifyMode = "update" 或 "build"）

使用 graphify 知识图谱替代 ENGINEERING-INDEX.md 的手动维护：

- **$graphifyMode = "update"**：执行 `/graphify . --update`，只重新提取变更文件并合并到已有图谱
- **$graphifyMode = "build"**：执行 `/graphify .`，首次构建完整图谱

graphify 会自动提取代码结构（AST + 语义提取）、构建社区聚类、生成可交互图谱和审计报告。无需手动维护 ENGINEERING-INDEX.md。

> ⚠️ 执行 `/graphify` 命令时，调用 `skill: "graphify-windows"` 工具，按照 graphify skill 的流程完整执行。不要只运行命令，要遵循 skill 中的全部步骤（检测文件、AST 提取、语义提取、合并、聚类、标签、生成输出）。

#### 路径 B：graphify 不可用（$graphifyMode = "unavailable"）

手动更新 .loom/ENGINEERING-INDEX.md，对照 `REFERENCE/update-checklist.md` 中的检查清单，逐一检查并更新。

**更新顺序：**
按项目架构分层的依赖顺序（从底层到上层），参考 `.loom/rules/project-structure.md` 中定义的分层：

1. 先更新底层数据源（数据库表等）
2. 再更新数据模型层
3. 再更新业务逻辑层
4. 再更新接口层
5. 最后更新路由层
6. 更新调用链 — 基于以上更新串联
7. 更新中间件、定时任务、队列、公共包等

**签名格式标准**（参考 `REFERENCE/update-checklist.md`）：

- 各层签名格式遵循项目语言的代码签名规范
- 数据库表：表名 | 用途 | 关键字段

### Step 3: 更新 MEMORY.md

**3.1 踩坑记录**

- 开发过程中发现了新的踩坑点 → 添加到"踩坑记录"节
- 格式：`- 问题描述；解决方案`

**3.2 用户偏好**

- 用户表达了新的偏好 → 添加到"用户偏好"节

**3.3 项目状态**

- 项目有重大变更（新增技术栈、架构调整等） → 更新"项目状态"节

### Step 4: 更新 {{ENTRY_FILE}}（仅在必要时）

以下情况才更新 {{ENTRY_FILE}}：

- 引入了新的约定或命令
- 入口程序有变化
- 开发流程有调整

一般性代码变更**不更新** {{ENTRY_FILE}}。

### Step 5: 输出更新报告

**路径 A（graphify 可用）的报告模板：**

```markdown
## 索引更新报告

**时间：** YYYY-MM-DD HH:mm
**触发原因：** <feature_name> 功能开发完成
**索引方式：** graphify 知识图谱（$graphifyMode）

### 知识图谱更新

- [x] graphify 已安装，执行：/graphify . --update（增量）/ /graphify .（首次构建）
- 输出位置：graphify-out/graph.html, graphify-out/GRAPH_REPORT.md, graphify-out/graph.json

### MEMORY.md 更新

- [ ] 踩坑记录：无新增
- [x] 用户偏好：新增偏好 XXX

### {{ENTRY_FILE}} 更新

- 无需更新
```

**路径 B（graphify 不可用）的报告模板：**

```markdown
## 索引更新报告

**时间：** YYYY-MM-DD HH:mm
**触发原因：** <feature_name> 功能开发完成
**索引方式：** 手动 ENGINEERING-INDEX.md

### ENGINEERING-INDEX.md 更新

| 节         | 变更类型 | 内容                                |
| ---------- | -------- | ----------------------------------- |
| 路由表     | 新增     | POST /xxx/edit → XxxController.Edit |
| 控制器签名 | 新增     | XxxController 完整签名              |
| 服务层签名 | 新增     | XxxService 完整签名                 |

### MEMORY.md 更新

- [ ] 踩坑记录：无新增
- [x] 用户偏好：新增偏好 XXX

### {{ENTRY_FILE}} 更新

- 无需更新
```

## 约束

- 只更新索引文件，不可修改业务代码
- 索引内容必须与实际代码一致（可对照源码验证）
- 如果不确定是否需要更新，宁可多检查不要漏
- 新增的表名、路由路径必须与代码中实际使用的完全一致
- **graphify 与 ENGINEERING-INDEX.md 互斥**：当 graphify 可用时使用知识图谱，不维护 ENGINEERING-INDEX.md；当不可用时回退到手动索引

## 完成条件与下一步

**索引更新完成后：**

1. 输出更新报告，确认所有索引文件已同步
2. 声明**工作完成，可以提交**

**索引未更新则禁止提交。**