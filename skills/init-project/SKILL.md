---
name: init-project
description: >
  项目初始化。扫描项目源码，自动生成宪章、工程结构、子 agent 上下文等配置文件。
  核心配置存放在 .loom/（工具无关），自动分发到检测到的 AI 编码工具目录。
  Use when: first setting up loom in a project, or when project structure has significantly changed.
  Trigger keywords: init-project, 初始化项目, 扫描项目, 生成配置
---

# 项目初始化 Skill

## 触发条件

- 用户输入 `/loom-init-project`
- 项目中不存在 `.loom/memory/constitution.md`（首次使用自动提示）
- 项目结构发生重大变更后重新生成

## 状态输出

执行开始时：

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
    constitution.md                ← 项目宪章
    MEMORY.md                      ← 记忆文件
  rules/
    project-structure.md           ← 工程结构约束
  templates/
    subagent-context.md            ← 子 agent 上下文
  skills/                          ← Skills
  commands/                        ← Commands
  hooks/                           ← Hooks
  core/                            ← 核心框架定义

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

**4.1 `.loom/memory/constitution.md`**（宪章）

从 `templates/constitution.md` 渲染，包含固定编码准则和项目专属原则：

```markdown
# 项目宪章

## 编码行为准则

...

## 核心原则（由扫描结果填充）

1. **{{ARCH_PRINCIPLE}}**：{{ARCH_DESC}}
2. **{{DI_PRINCIPLE}}**：{{DI_DESC}}
3. **{{CONFIG_PRINCIPLE}}**：{{CONFIG_DESC}}
4. **{{ERROR_PRINCIPLE}}**：{{ERROR_DESC}}
5. **{{CODEGEN_PRINCIPLE}}**：{{CODEGEN_DESC}}

## 技术栈

...

## 编码红线

...

## 项目约束

...

## 开发流程

...

## 治理规则

...
```

**4.2 `.loom/rules/project-structure.md`**（工程结构）

从 `templates/project-structure.md` 渲染：

```markdown
# 工程结构约束

## 目录结构

{{DIRECTORY_TREE}}

## 架构模式

{{ARCH_PATTERN}}

## 编码要求

...
```

**4.3 `.loom/memory/MEMORY.md`**（记忆文件）

从 `templates/memory.md` 渲染，初始化为空模板。

**4.4 `.loom/templates/subagent-context.md`**（子 agent 上下文模板）

从`.loom/memory/constitution.md`和`.loom/rules/project-structure.md`的内容中生成精简版项目约束。

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

| 工具        | 分发目标                              | 格式    | 内容                                       |
| ----------- | ------------------------------------- | ------- | ------------------------------------------ |
| Claude Code | `.claude/CLAUDE.md`                   | wrapper | 指引读取 `.loom/memory/constitution.md` 等 |
| OpenCode    | `AGENTS.md`                           | wrapper | 指引读取 `.loom/memory/constitution.md` 等 |
| Cursor      | `.cursor/rules/constitution.mdc`      | mdc     | 完整复制 + frontmatter                     |
| Cursor      | `.cursor/rules/project-structure.mdc` | mdc     | 完整复制 + frontmatter                     |
| Copilot     | `.github/copilot-instructions.md`     | wrapper | 指引读取 `.loom/memory/constitution.md` 等 |
| Codex       | `AGENTS.md`                           | wrapper | 同 OpenCode，共享文件                      |

**分发原则：**

- `.loom/` 是唯一维护点，wrapper 文件只放引用指引，不复制内容
- Cursor 的 `.mdc` 格式例外，因 Cursor 不支持跨目录引用，需完整复制
- 同一文件被多个工具共享时（如 `AGENTS.md`），只生成一次

**5.3 分发格式适配**

**Wrapper 模板（Claude Code / OpenCode / Copilot / Codex）：**

所有 wrapper 文件使用统一模板，根据工具特性微调：

```markdown
# {{PROJECT_NAME}} — AI 编码指令

> 本文件由 loom init-project 自动生成。修改请编辑 `.loom/` 源文件，重新运行 `/loom-init-project` 重新分发。

## 必读规则

在开始任何编码任务前，必须先读取以下文件：

1. `.loom/memory/constitution.md` — 项目宪章（编码准则、红线、技术栈）
2. `.loom/rules/project-structure.md` — 工程结构约束（目录分层、架构模式）
3. `.loom/memory/MEMORY.md` — 项目记忆（踩坑记录、用户偏好）

## 快速参考

- **语言**：{{LANGUAGE}}
- **框架**：{{WEB_FRAMEWORK}}
- **构建**：`{{BUILD_CMD}}`
- **测试**：`{{TEST_CMD}}`
- **检查**：`{{VET_CMD}}`
```

**Cursor mdc 模板（完整复制）：**

```markdown
---
description: [文件描述]
globs:
alwaysApply: true
---

[.loom/ 源文件的完整内容]
```

**工具特定适配：**

- **Claude Code** (`CLAUDE.md`)：使用上述 wrapper 模板。Claude Code 支持自动读取项目文件，wrapper 中的指引会被遵循。
- **OpenCode / Codex** (`AGENTS.md`)：使用上述 wrapper 模板。两者都读取 `AGENTS.md`。
- **Copilot** (`copilot-instructions.md`)：使用上述 wrapper 模板。Copilot 会自动加载 `.github/copilot-instructions.md`。
- **Cursor** (`.cursor/rules/*.mdc`)：完整复制 `.loom/` 内容 + frontmatter。Cursor 不支持跨目录引用。

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

| 文件                             | 状态      | 说明                   |
| -------------------------------- | --------- | ---------------------- |
| .loom/memory/constitution.md     | ✅ 已生成 | 项目宪章，5 项核心原则 |
| .loom/rules/project-structure.md | ✅ 已生成 | 工程结构约束           |
| .loom/memory.md                  | ✅ 已生成 | 记忆文件（空模板）     |
| .loom/subagent-context.md        | ✅ 已生成 | 子 agent 精简上下文    |

### 工具适配分发

| 工具           | 检测结果                 | 分发文件                             | 状态      |
| -------------- | ------------------------ | ------------------------------------ | --------- |
| Claude Code    | ✅ 检测到 .claude/       | `.claude/CLAUDE.md` (wrapper)        | ✅ 已分发 |
| OpenCode       | ✅ 检测到 .opencode/     | `AGENTS.md` (wrapper)                | ✅ 已分发 |
| Cursor         | ✅ 检测到 .cursor/       | `.cursor/rules/constitution.mdc` + 1 | ✅ 已分发 |
| GitHub Copilot | ✅ 检测到 .github/       | `.github/copilot-instructions.md`    | ✅ 已分发 |
| Codex          | ⬜ 未检测到              | —                                    | ⬜ 跳过   |

### 需人工完善的 [TODO]

- [ ] .loom/memory/constitution.md 中的「编码红线」需确认是否完整
- [ ] .loom/rules/project-structure.md 中的「开发流程」需确认
- [ ] .loom/memory.md 需在使用中逐步积累
```

## 模板变量

| 变量                     | 来源                  | 示例                                          |
| ------------------------ | --------------------- | --------------------------------------------- |
| `{{PROJECT_NAME}}`       | 目录名 / go module    | my-project                                    |
| `{{PROJECT_DESC}}`       | README / 用户输入     | 项目描述                                      |
| `{{LANGUAGE}}`           | go.mod / package.json | Go 1.24                                       |
| `{{WEB_FRAMEWORK}}`      | import 分析           | Gin 1.9                                       |
| `{{ORM}}`                | import 分析           | GORM + GORM Gen                               |
| `{{DATABASE}}`           | import 分析           | MySQL 5.7                                     |
| `{{CACHE}}`              | import 分析           | Redis                                         |
| `{{LOGGING}}`            | import 分析           | Zap                                           |
| `{{DI}}`                 | import 分析           | Google Wire                                   |
| `{{ARCH_PATTERN}}`       | 目录结构推断          | Router→Controller→Service→Repository          |
| `{{ENTRY_POINTS}}`       | cmd/ / main.\* 扫描   | cmd/server, cmd/queue                         |
| `{{TEST_CMD}}`           | 语言检测              | go test ./... -v -count=1                     |
| `{{BUILD_CMD}}`          | 语言检测              | go build ./...                                |
| `{{VET_CMD}}`            | 语言检测              | go vet ./...                                  |
| `{{ERROR_PATTERN}}`      | 源码分析              | errs.New(code, msg)                           |
| `{{RESPONSE_PATTERN}}`   | 源码分析              | response.Backend\*\*\*Response                |
| `{{CODING_REDLINES}}`    | 模式检测 + 默认       | 自动生成编码红线列表                          |
| `{{LOGGING_PATTERN}}`    | 源码分析              | logger.Info("描述", zap.String("key", value)) |
| `{{DI_PATTERN}}`         | 源码分析              | Google Wire                                   |
| `{{ARCH_PRINCIPLE}}`     | 架构推断              | 分层架构                                      |
| `{{ARCH_DESC}}`          | 架构推断              | Router→Controller→Service→Repository          |
| `{{DI_PRINCIPLE}}`       | DI 检测               | 依赖注入                                      |
| `{{DI_DESC}}`            | DI 检测               | Google Wire 自动生成依赖图                    |
| `{{CONFIG_PRINCIPLE}}`   | 配置检测              | 配置外置                                      |
| `{{CONFIG_DESC}}`        | 配置检测              | 环境变量 + 配置文件分离                       |
| `{{ERROR_PRINCIPLE}}`    | 错误处理检测          | 统一错误处理                                  |
| `{{ERROR_DESC}}`         | 错误处理检测          | 统一错误码 + 包装错误                         |
| `{{CODEGEN_PRINCIPLE}}`  | 代码生成检测          | 代码生成                                      |
| `{{CODEGEN_DESC}}`       | 代码生成检测          | GORM Gen 自动生成 Model                       |
| `{{LANGUAGE_VERSION}}`   | 版本检测              | Go 1.24                                       |
| `{{FRAMEWORK_VERSION}}`  | 版本检测              | Gin 1.9                                       |
| `{{ORM_VERSION}}`        | 版本检测              | GORM v2                                       |
| `{{DATABASE_VERSION}}`   | 版本检测              | MySQL 5.7                                     |
| `{{CACHE_VERSION}}`      | 版本检测              | go-redis v9                                   |
| `{{LOGGING_VERSION}}`    | 版本检测              | Zap v1.27                                     |
| `{{DI_VERSION}}`         | 版本检测              | Wire v0.6                                     |
| `{{DEV_FLOW}}`           | 用户确认              | clone → branch → code → test → PR             |
| `{{DIRECTORY_TREE}}`     | 目录扫描              | 自动生成目录树                                |
| `{{TECH_STACK_SUMMARY}}` | 汇总                  | Go 1.24 + Gin + GORM + MySQL                  |

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
4. 后续可使用 `/loom-import-rules` 导入已有项目规则
