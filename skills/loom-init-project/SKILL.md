---
name: loom-init-project
description: >
  项目初始化。扫描项目源码，自动生成宪章、工程结构、子 agent 上下文等配置文件。
  核心配置存放在 .loom/，自动分发到检测到的 AI 编码工具目录。
  适用场景: 首次使用loom框架；项目结构发生重大变更；需要重新生成配置文件。
  Trigger keywords: init-project, 初始化项目, 扫描项目, 生成配置
---

# 项目初始化 Skill

## 触发条件

- 用户输入 `/loom-init-project`
- 项目中不存在 `.loom/rules/constitution.md`（首次使用自动提示）
- 项目结构发生重大变更后重新生成

## 状态输出

- 开始：`▶ pipeline [init] — 项目初始化 (init-project) | status: 开始`
- 完成：`✅ pipeline [init] — 项目初始化 | 完成 | 4 个核心文件 + N 个工具适配文件 | → 检查并完善 [TODO]`

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 pipeline [init] — 项目初始化 (init-project)
 skill:   init-project
 status:  ▶ 开始执行
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

执行结束时：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 pipeline [init] — 项目初始化 (init-project)
 status:  ✅ 完成
 输出:    4 个核心文件 + N 个工具适配文件
 下一步:  检查生成的文件，手动完善 [TODO] 部分
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 目录架构

```
.loom/                              ← 核心配置（工具无关，唯一维护点）
  memory/
    MEMORY.md                      ← 记忆文件
  rules/
    constitution.md                ← 项目宪章
    project-structure.md           ← 工程结构约束
  contexts/
    subagent-context.md            ← 子 agent 上下文
  index/
    ENGINEERING-INDEX.md           ← 工程索引，使用graphify时此文件无效
  workflow.yaml                    ← 开发流程约束

.claude/CLAUDE.md                  ← Claude Code 入口（wrapper → .loom/）
AGENTS.md                          ← OpenCode / Codex 入口（wrapper → .loom/）

.cursor/                           ← Cursor 适配（mdc → .loom/）
  rules/
    constitution.mdc
    project-structure.mdc

.github/copilot-instructions.md    ← GitHub Copilot 入口（wrapper → .loom/）
```

## 执行流程

### Step 1: 扫描项目根目录

检测项目基本信息：

| 检测项   | 方法                                               | 示例                |
| -------- | -------------------------------------------------- | ------------------- |
| 项目名称 | 目录名 / go module / package.json                  | my-project          |
| 项目描述 | README.md 首段                                     | 项目描述            |
| 语言     | go.mod / package.json / requirements.txt / pom.xml | Go 1.24             |
| 框架     | import 分析                                        | Gin 1.9             |
| ORM      | import 分析                                        | GORM + GORM Gen     |
| 数据库   | import 分析                                        | MySQL 5.7           |
| 缓存     | import 分析                                        | Redis (go-redis v9) |
| 搜索     | import 分析                                        | Elasticsearch 9.x   |
| 日志     | import 分析                                        | Zap                 |
| DI       | import 分析                                        | Google Wire         |

**语言检测后，生成对应的构建/测试/检查命令：**

| 语言    | BUILD_CMD                      | VET_CMD                                 | TEST_CMD                    |
| ------- | ------------------------------ | --------------------------------------- | --------------------------- |
| Go      | `go build ./...`               | `go vet ./...`                          | `go test ./... -v -count=1` |
| Python  | `python -m py_compile .`       | `ruff check .`                          | `pytest -v`                 |
| Node.js | `npx tsc --noEmit`             | `eslint .`                              | `npm test`                  |
| Rust    | `cargo build`                  | `cargo clippy`                          | `cargo test`                |
| Java    | `mvn compile` / `gradle build` | `mvn checkstyle:check` / `gradle check` | `mvn test` / `gradle test`  |

写入宪章 `{{BUILD_CMD}}`、`{{VET_CMD}}`、`{{TEST_CMD}}` 变量。

### Step 2: 深度分析源码

**2.1 提取错误处理模式**

- 搜索 `error`、`Error`、`err`、`throw`、`panic`、`Result`
- 分析错误处理模式（统一错误码？包装错误？）

**2.2 提取响应格式**

- 搜索 `Response`、`reply`、`json`、`Success`、`Error`
- 分析响应格式（统一结构？错误码体系？）

**2.3 提取日志模式**

- 搜索 `logger`、`log.`、`Info(`、`Error(`、`Debug(`
- 分析日志格式和用法

**2.4 提取 DI 模式**

- 搜索 `wire`、`inject`、`Provide`、`Autowired`、`NewXxx`
- 分析依赖注入方式

**2.5 提取数据库模式**

- 搜索 `gorm`、`sqlalchemy`、`prisma`、`db.`
- 分析数据访问层模式

**2.6 提取编码红线**

- 搜索常见的违规模式
- 从现有代码推断项目规范

### Step 3: 提取目录结构

分析项目目录结构，推断架构模式（以下为 Go 项目示例，实际按项目语言推断）：

```
项目目录 → 架构分层映射
cmd/          → 入口程序
config/       → 配置管理
internal/
  controllers/ → 控制器层
  service/     → 业务逻辑层
  models/      → 数据模型层
  repository/  → 数据访问层
  middleware/  → 中间件
  routers/     → 路由定义
  utils/       → 工具函数
pkg/          → 公共工具包
```

### Step 4: 生成核心配置文件到 `.loom/`

必须读取 `templates/` 目录下的模板文件，渲染变量后写入 `.loom/`, 禁止擅自删减内容：

| 源模板                                   | 目标文件                             | 说明                                              |
| ---------------------------------------- | ------------------------------------ | ------------------------------------------------- |
| `templates/constitution.md`              | `.loom/rules/constitution.md`        | 项目宪章                                          |
| `templates/project-structure.md`         | `.loom/rules/project-structure.md`   | 工程结构约束                                      |
| `templates/memory.md`                    | `.loom/memory/MEMORY.md`             | 记忆文件（空模板）                                |
| 从 constitution + project-structure 提取 | `.loom/contexts/subagent-context.md` | 子 agent 精简上下文                               |
| `templates/engineering-index.md`         | `.loom/index/engineering-index.md`   | 工程索引（空模板，graphify 可用时由知识图谱替代） |
| `templates/workflow.yaml`                | `.loom/workflow.yaml`                | 开发流程约束                                      |

渲染时用 Step 1-3 扫描结果替换模板中的 `{{变量}}`。详见「模板变量」节。

### Step 5: 检测工具目录并分发

**5.1 检测项目中存在的 AI 编码工具**

| 检测目标                    | 对应工具           | 分发目标                          |
| --------------------------- | ------------------ | --------------------------------- |
| `.claude/` 目录或 CLAUDE.md | Claude Code        | `.claude/CLAUDE.md` (wrapper)     |
| `.opencode/` 目录           | OpenCode           | `AGENTS.md` (wrapper)             |
| `.cursor/` 目录             | Cursor             | `.cursor/rules/*.mdc` (完整复制)  |
| `.github/` 目录             | GitHub Copilot     | `.github/copilot-instructions.md` |
| `AGENTS.md` 文件            | Codex / 通用 agent | `AGENTS.md` (wrapper)             |

检测逻辑：

1. 检查项目根目录下是否存在上述目录/文件
2. 如果没有任何工具目录被检测到，询问用户使用哪些工具（列出所有支持的工具）
3. 根据用户回答创建对应目录和 wrapper 文件

**5.2 分发规则**

所有工具统一使用 wrapper 模式：入口文件引用 `.loom/` 下的源文件，AI 工具运行时按需读取。

| 工具        | 分发目标                              | 格式    | 内容                                      |
| ----------- | ------------------------------------- | ------- | ----------------------------------------- |
| Claude Code | `.claude/CLAUDE.md`                   | wrapper | 指引读取 `.loom/rules/constitution.md` 等 |
| Claude Code | `.claudeignore`                       | ignore  | 过滤 node_modules、vendor 等目录          |
| OpenCode    | `AGENTS.md`                           | wrapper | 指引读取 `.loom/rules/constitution.md` 等 |
| OpenCode    | `opencode.json` 的 `watcher.ignore`   | config  | 过滤 node_modules、vendor 等目录          |
| Cursor      | `.cursor/rules/constitution.mdc`      | mdc     | 完整复制 + frontmatter                    |
| Cursor      | `.cursor/rules/project-structure.mdc` | mdc     | 完整复制 + frontmatter                    |
| Cursor      | `.cursorignore`                       | ignore  | 过滤 node_modules、vendor 等目录          |
| Copilot     | `.github/copilot-instructions.md`     | wrapper | 指引读取 `.loom/rules/constitution.md` 等 |
| Codex       | `AGENTS.md`                           | wrapper | 同 OpenCode，共享文件                     |
| Codex       | `.codexignore`                        | ignore  | 过滤 node_modules、vendor 等目录          |

**分发原则：**

- `.loom/` 是唯一维护点，wrapper 文件只放引用指引，不复制内容
- Cursor 的 `.mdc` 格式例外，因 Cursor 不支持跨目录引用，需完整复制
- 同一文件被多个工具共享时（如 `AGENTS.md`），只生成一次

**5.3 分发格式适配**

**Wrapper 模板（Claude Code / OpenCode / Copilot / Codex）：**

从 `templates/loom.md` 读取内容，渲染变量后写入 wrapper 文件

**Cursor mdc 模板（完整复制）：**

```markdown
---
description: [文件描述]
globs:
alwaysApply: true
---

从 `templates/loom.md` 读取内容，渲染变量后写入 `.loom/`
```

**工具特定适配：**

- **Claude Code** (`CLAUDE.md`)：使用上述 wrapper 模板。Claude Code 支持自动读取项目文件，wrapper 中的指引会被遵循。
- **OpenCode / Codex** (`AGENTS.md`)：使用上述 wrapper 模板。两者都读取 `AGENTS.md`。
- **Copilot** (`copilot-instructions.md`)：使用上述 wrapper 模板。Copilot 会自动加载 `.github/copilot-instructions.md`。
- **Cursor** (`.cursor/rules/*.mdc`)：完整复制 `.loom/` 内容 + frontmatter。Cursor 不支持跨目录引用。

**5.3.1 忽略配置模板**

所有工具共享以下通用忽略列表：

```
node_modules/ vendor/ dist/ build/ .cache/ .git/ *.lock *.log
__pycache__/ .venv/ venv/ .coverage/ *.pyc *.pyo *.egg-info/ .tox/ .worktree/
```

| 工具        | 输出文件                            | 额外条目 | 备注                                       |
| ----------- | ----------------------------------- | -------- | ------------------------------------------ |
| Claude Code | `.claudeignore`                     | —        | 自动生成 `# 由 loom init-project 自动生成` |
| Cursor      | `.cursorignore`                     | —        | 同上                                       |
| Codex       | `.codexignore`                      | —        | 同上                                       |
| OpenCode    | `opencode.json` 的 `watcher.ignore` | —        | 合并到已有配置，不覆盖其他字段             |

生成规则：

- 根据项目语言追加特定忽略项（如 Python 追加 `__pycache__/`、`.venv/`）
- 已有忽略文件时，检查是否包含 `loom` 标记，有则覆盖，无则跳过并提示

**5.4 分发执行**

- 已有目标文件时，提示用户确认是否覆盖
- 分发后在报告中记录每个目标的状态
- wrapper 文件只包含引用指引，不包含 `.loom/` 源文件的完整内容

### Step 6: 输出报告

```markdown
## 项目初始化报告

**项目名称：** {{PROJECT_NAME}}
**检测到的技术栈：** {{TECH_STACK_SUMMARY}}

### 核心配置文件（`.loom/`）

| 文件                               | 状态      | 说明                   |
| ---------------------------------- | --------- | ---------------------- |
| .loom/rules/constitution.md        | ✅ 已生成 | 项目宪章，5 项核心原则 |
| .loom/rules/project-structure.md   | ✅ 已生成 | 工程结构约束           |
| .loom/memory.md                    | ✅ 已生成 | 记忆文件（空模板）     |
| .loom/contexts/subagent-context.md | ✅ 已生成 | 子 agent 精简上下文    |
| .loom/index/engineering-index.md   | ✅ 已生成 | 工程索引（空模板）     |

### 工具适配分发

| 工具           | 检测结果             | 分发文件                             | 状态      |
| -------------- | -------------------- | ------------------------------------ | --------- |
| Claude Code    | ✅ 检测到 .claude/   | `.claude/CLAUDE.md` (wrapper)        | ✅ 已分发 |
| Claude Code    |                      | `.claudeignore`                      | ✅ 已生成 |
| OpenCode       | ✅ 检测到 .opencode/ | `AGENTS.md` (wrapper)                | ✅ 已分发 |
| OpenCode       |                      | `opencode.json` watcher.ignore       | ✅ 已合并 |
| Cursor         | ✅ 检测到 .cursor/   | `.cursor/rules/constitution.mdc` + 1 | ✅ 已分发 |
| Cursor         |                      | `.cursorignore`                      | ✅ 已生成 |
| GitHub Copilot | ✅ 检测到 .github/   | `.github/copilot-instructions.md`    | ✅ 已分发 |
| Codex          | ⬜ 未检测到          | —                                    | ⬜ 跳过   |

### 需人工完善的 [TODO]

- [ ] .loom/rules/constitution.md 中的「编码红线」需确认是否完整
- [ ] .loom/rules/project-structure.md 中的「开发流程」需确认
- [ ] .loom/memory.md 需在使用中逐步积累
```

## 模板变量

| 分组   | 变量                                                                                                                                         | 来源          |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 技术栈 | PROJECT_NAME, PROJECT_DESC, LANGUAGE, WEB_FRAMEWORK, ORM, DATABASE, CACHE, LOGGING, DI                                                       | Step 1 扫描   |
| 架构   | ARCH_PATTERN, ARCH_PRINCIPLE, ARCH_DESC, DIRECTORY_TREE, ENTRY_POINTS                                                                        | Step 3 推断   |
| 命令   | BUILD_CMD, VET_CMD, TEST_CMD, LANGUAGE_VERSION, FRAMEWORK_VERSION, ORM_VERSION, DATABASE_VERSION, CACHE_VERSION, LOGGING_VERSION, DI_VERSION | Step 1 生成   |
| 模式   | ERROR_PATTERN, RESPONSE_PATTERN, CODING_REDLINES, LOGGING_PATTERN, DI_PATTERN                                                                | Step 2 分析   |
| 配置   | ARCH_PRINCIPLE/DESC, DI_PRINCIPLE/DESC, CONFIG_PRINCIPLE/DESC, ERROR_PRINCIPLE/DESC, CODEGEN_PRINCIPLE/DESC                                  | Step 2+推断   |
| 其他   | DEV_FLOW, TECH_STACK_SUMMARY                                                                                                                 | 用户确认+汇总 |

## 约束

- `.loom/` 是唯一维护点，所有 wrapper 文件只包含引用指引，不复制 `.loom/` 内容
- Cursor 的 `.mdc` 文件例外，因 Cursor 不支持跨目录引用，需完整复制
- 已有配置文件时，必须提示用户确认是否覆盖
- 检测到不明确的信息时，使用 `[TODO]` 标记
- 生成的文件必须是完整可用的，不包含未渲染的模板变量
- 禁止修改任何业务代码
- 分发时自动创建不存在的工具目录（如用户确认使用该工具）
- wrapper 文件之间内容一致，仅文件名和位置不同

## 完成条件与下一步

初始化完成后：

1. 输出报告，列出已生成文件和分发状态
2. 提示用户检查 `.loom/` 下的核心文件并完善 [TODO]
3. 提示用户：修改配置应只改 `.loom/`，wrapper 文件会自动引用最新内容
