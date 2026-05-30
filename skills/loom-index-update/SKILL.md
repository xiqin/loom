---
name: loom-index-update
description: >
  Synchronize engineering index, memory file, and entry docs with code after verification passes.
---

# 索引更新 Skill

## 触发条件

- 功能测试和 completion verification 通过后自动触发。
- 用户手动要求更新索引、同步索引或更新文档。

## 前置条件

1. 代码变更已完成。
2. `loom-verification-before-completion` 已通过，或用户明确要求只更新索引。

## 执行流程

### Step 1：检测变更范围

1. 运行 `git diff --name-only HEAD` 确认变更文件。
2. 按 `references/update-checklist.md` 判断需要更新哪些索引。

### Step 2：更新工程结构索引

**统一入口 `loom index` 会自动选择后端**：检测到 codegraph（`.codegraph/` 存在或 CLI 在 PATH）即委派给它，否则降级为正则静态扫描。日常只需：

```bash
loom index            # 同步索引（自动路由 codegraph sync 或静态扫描）
loom index --check    # 检查索引是否过期（用于 CI / pre-commit）
loom index --no-codegraph   # 强制走静态扫描器
```

路径 A：**codegraph 可用**时，`loom index` 委派 `codegraph sync`，**不生成 engineering-index.md**，AI 直接通过 MCP 工具按需查询：

```bash
codegraph init        # 仅首次：项目内尚无 .codegraph/ 时建图（loom init-project 已自动执行）
```

codegraph 基于 tree-sitter AST 解析，提取符号、路由、调用链并存入 SQLite，通过 MCP 实时查询：
- `codegraph_search` — 按名称搜索符号
- `codegraph_context` — 查询符号上下文
- `codegraph_trace` / `codegraph_callers` / `codegraph_callees` — 查询调用链
- `codegraph_impact` — 确认改动影响半径
- `codegraph_files` / `codegraph_explore` — 查询模块结构

engineering-index.md **不再需要**，codegraph 本身即索引。

路径 B：**codegraph 不可用**时，`loom index` 自动降级为正则静态扫描，生成 `.loom/index/engineering-index.md`，自动提取路由定义、控制器/服务/模型/仓库层导出符号。生成后**必须人工或 AI 审查**：
- `## Call Chains` 章节（无法自动推断，需手动补充）
- 自动检测遗漏的路由或模块（如动态注册路由）
- 确认提取的函数签名与源码一致

### Step 3：更新 MEMORY.md

MEMORY.md 采用分区结构，**必须写入对应分区，禁止随意追加到文件末尾**。

**判断写入目标：**

| 内容类型 | 写入分区 | 操作 |
|----------|----------|------|
| 本次会话的关键结论（决策/踩坑/偏好/状态变更） | `📌 摘要` | 在列表顶部插入一行，超过 10 条时删除最旧一条 |
| 技术选型、架构决定，需要保留背景和原因 | `🏗 架构决策（ADR）` | 在表格顶部插入一行 |
| 实际遇到的坑，含根因和解决方式 | `⚠️ 踩坑记录` | 追加，包含：问题描述 + 根因 + 解决方式 |
| 用户明确表达的工作习惯、风格偏好、禁止事项 | `👤 用户偏好` | 追加，用 `-` 列表，语言简洁 |
| 技术栈或当前阶段变化 | `🏗 项目状态` | 就地修改对应字段 |
| 本次会话有重要内容需要归档 | `📦 会话归档索引` + `sessions/` | 见"会话归档"说明 |

**摘要行格式：**
```
YYYY-MM-DD | <类型> | <一句话描述>
```
类型只能是：`决策` / `踩坑` / `偏好` / `状态`

**会话归档规则：**
- 触发条件：本次会话产生 2 条以上重要内容，或单条内容较长（>200 字）。
- 在 `sessions/` 目录创建文件，命名为 `YYYY-MM-DD-<feature-slug>.md`，内容为本次会话的完整记录。
- 在 `📦 会话归档索引` 表格顶部插入一行，格式：`| sessions/YYYY-MM-DD-<slug>.md | YYYY-MM-DD | <一句话摘要> |`
- 摘要区对应条目保留，归档文件存放详情。

**不写入的情况：**
- 一般性代码变更（无决策、无踩坑、无偏好变化）→ 不更新 MEMORY.md。
- 临时调试信息、过程性日志 → 不写入。

### Step 4：必要时更新入口文件

只有引入新约定、新命令、入口程序变化或开发流程调整时，才更新入口文件。一般性代码变更不更新。

### Step 5：输出报告

报告模板见：

- `assets/report-codegraph-template.md`（路径 A）
- `assets/report-manual-template.md`（路径 B）

## 约束

- 只更新索引和记忆文件，不修改业务代码。
- 索引内容必须与实际代码一致。
- 新增表名、路由路径、方法签名必须与源码完全一致。
- 统一调 `loom index`，由它按 codegraph 可用性自动选后端（路径 A 委派 / 路径 B 静态扫描）。

## 完成条件与下一步

索引更新完成后输出报告，确认所有索引文件已同步；索引未更新则禁止提交。