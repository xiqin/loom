# 架构

loom 项目的代码架构和模块组织。

## 目录结构

```
loom/
├── bin/loom.js              # CLI 入口
├── src/
│   ├── cli.js              # CLI 命令注册（commander）
│   ├── commands/           # CLI 命令实现
│   │   ├── install.js      # loom install
│   │   ├── uninstall.js    # loom uninstall
│   │   ├── update.js       # loom update
│   │   ├── doctor.js       # loom doctor
│   │   └── list.js         # loom list
│   ├── adapters/           # 工具适配器（user-level）
│   │   ├── base.js         # BaseAdapter 基类
│   │   ├── claude-code.js  # Claude Code 适配器
│   │   ├── cursor.js       # Cursor 适配器
│   │   ├── copilot.js      # Copilot 适配器
│   │   ├── cursor-converter.js # Cursor rules 转换
│   │   ├── opencode.js     # OpenCode 适配器
│   │   └── codex.js        # Codex 适配器
│   ├── core/               # 核心逻辑
│   │   └── installer.js    # 安装器
│   └── generated/          # 自动生成
│       └── tooling.js      # 从 tools.schema.json 生成
├── config/                 # Schema 定义
│   ├── tools.schema.json   # 工具定义
│   ├── hooks.schema.json   # Hook 系统定义
│   ├── pipeline.schema.json # 流水线状态机
│   ├── review.schema.json  # 审查框架
│   └── templates.schema.json # 模板定义
├── skills/                 # Skills 定义
├── commands/               # Commands 定义
├── hooks/                  # Hook 系统
│   ├── hooks.json          # Hook 注册表
│   ├── run-hook.js         # Hook runner
│   ├── session-start       # Shell wrapper
│   └── handlers/           # Hook 处理器
│       └── session-start.cjs
├── templates/              # 项目模板
├── .claude-plugin/         # 插件元数据
├── scripts/                # 构建脚本
│   ├── generate-tooling.mjs
│   ├── generate-plugin-meta.mjs
│   ├── generate-skills-catalog.mjs
│   ├── generate-review-summary.mjs
│   ├── generate-model-selection.mjs
│   ├── generate-shared-rules.mjs
│   └── sync-version.mjs
└── tests/                  # 测试套件
```

## 核心模块

### CLI 层

```
bin/loom.js → src/cli.js → src/commands/*.js
```

- `bin/loom.js`：Node.js 入口，加载 `src/cli.js`
- `src/cli.js`：使用 commander 注册命令
- `src/commands/`：每个命令一个文件

### 适配器层

```
src/core/installer.js → src/adapters/<tool>.js → src/adapters/base.js
```

- `BaseAdapter`：基类，提供 `_copySkills`、`_copyCommands`、`_copyDir` 等公共方法
- 每个工具一个适配器，实现 `toolName`、`getUserDir()`、`getSkillsDir()`、`getCommandsDir()`
- `installer.js`：通过 `ADAPTER_MAP` 注册适配器，提供 `getUserAdapter(tool)`、`USER_TOOL_IDS`

### 核心层

```
src/core/installer.js    — 适配器注册与获取（ADAPTER_MAP、getUserAdapter）
```

**安装流程** (`loom install --tool <target>`)：

1. 通过 `getUserAdapter(tool)` 获取适配器
2. 调用 `adapter.install(loomRoot, version)`
3. 复制 skills（含 `SKILL.md` 的子目录）到用户目录
4. 复制 commands（`.md` 文件）到用户目录
5. 注册插件（Claude Code / OpenCode）

**卸载流程** (`loom uninstall --tool <target>`)：

1. 通过 `getUserAdapter(tool)` 获取适配器
2. 调用 `adapter.uninstall(loomRoot)`
3. 删除 loom 安装的 skills 子目录
4. 删除 loom 安装的 commands 文件
5. 注销插件配置

## 数据流

### 安装数据流

```
CLI (loom install --tool <target>)
  → getUserAdapter(tool) → adapter
  → adapter.install(loomRoot, version)
    → _copySkills() → 复制 skills 到 getUserDir()/skills/
    → _copyCommands() → 复制 commands 到 getCommandsDir()
    → _postInstall() → 工具特定后处理
    → _registerPlugin() → 插件系统注册（Claude Code / OpenCode）
```

### 卸载数据流

```
CLI (loom uninstall --tool <target>)
  → getUserAdapter(tool) → adapter
  → adapter.uninstall(loomRoot)
    → _removeSkills() → 删除 loom 安装的 skills
    → _removeCommands() → 删除 loom 安装的 commands
    → _removeGlobalInstructions() → 清理工具特定配置（Copilot）
```

## Hook 系统

```
hooks/session-start (shell wrapper)
  → hooks/run-hook.js session-start
    → loadHooks() → hooks.json
    → findHook() → hook definition
    → supportsPlatform() → platform check
    → _require(handlerPath) → .cjs handler
    → withTimeout(handler, timeoutMs) → execute
    → fallback handling (skip/warn/error/retry)
```

### Fallback 策略

| 策略 | 行为 | 退出码 |
|------|------|--------|
| `skip` | 静默跳过 | 0 |
| `warn` | 输出警告，继续执行 | 0 |
| `error` | 输出错误，终止 | 1 |
| `retry` | 重试 N 次后仍失败则 error | 1 |

## Schema 驱动

loom 使用 JSON Schema 定义配置：

- `tools.schema.json` → `scripts/generate-tooling.mjs` → `src/generated/tooling.js`
- `hooks.schema.json` → 驱动 `hooks/run-hook.js`
- `pipeline.schema.json` → 驱动流水线状态机
- `review.schema.json` → 驱动审查框架
- `templates.schema.json` → 驱动模板渲染和验证

修改 schema 后需要重新生成：

```bash
node scripts/generate-tooling.mjs    # 重新生成 tooling.js
node scripts/sync-version.mjs        # 同步版本号
```

## 测试架构

```
tests/
├── commands/       # CLI 命令测试
├── adapters/       # 适配器测试
└── hooks/          # Hook 系统测试
```

测试框架：vitest。运行：

```bash
npm test            # 运行所有测试
npm run test:watch  # 监听模式
```

## v2.0 新增模块

### 执行引擎 (方向1)

```
src/core/
├── pipeline-engine.js    — 状态机控制器（检查产物→推进阶段→校验→阻断）
├── state-store.js        — 每 spec 独立的 pipeline.state.json + task-states/*.state.json
├── lock.js               — PID 文件锁（.loom-run.lock）防重复启动
└── artifact-checker.js   — 产物存在性 + 内容校验 + 阶段推断

src/commands/
├── run.js                — loom run (init / advance / approve / fail / recover / task-state)
└── status.js             — loom status (单 spec 详情 / 全景视图)
```

**状态隔离设计：**

```
specs/2026-05-27+user-auth/
  pipeline.state.json     ← 只由管理该 spec 的 loom run 进程写
  .loom-run.lock          ← PID 文件锁
  task-states/
    T1.state.json         ← 只由 T1 的 subagent 写
    T2.state.json
  handoffs/
    T1.json
    T2.json
  progress.md             ← 由 state-store 汇总生成（只读视图）
```

每一层的写入者唯一，不需要锁、不需要事务。

### 结构化记忆 (方向2)

```
src/core/memory-store.js  — JSON 文件存储（.loom/memory/store.json）
src/commands/memory.js    — loom memory add/list/export/merge/remove/archive
```

MEMORY.md 变为只读导出视图，由 `loom memory export` 生成。

### MCP Server (方向3)

```
src/mcp/
├── server.js             — stdio transport JSON-RPC 服务
├── tools.js              — 8 个 MCP 工具定义 + 执行
└── session-store.js      — 连接级 spec 绑定（loom_attach_spec）
```

配置方式：
```json
{ "mcpServers": { "loom": { "command": "loom", "args": ["mcp-serve"] } } }
```

### Skill 质量度量 (方向5)

```
src/core/compliance-tracker.js  — 读 verify-report + stage_history，写 .loom/compliance/history.json
```

`loom doctor` 展示高风险 skill 列表（遵守率 < 80%）。
