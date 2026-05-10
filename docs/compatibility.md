# 工具兼容性

loom 支持多种 AI 编程工具。每个工具通过独立的适配器实现。

## 支持等级

| 等级 | 含义 |
|------|------|
| `full` | 完整支持，适配器已实现，可安装、更新、卸载 |
| `planned` | 计划中，适配器待实现 |

## 工具详情

### Claude Code（full）

- **入口文件**：`CLAUDE.md`（项目根目录）
- **Skills 发现**：`skills/` + `.loom/skills/`（双路径）
- **Commands 发现**：`commands/` + `.loom/commands/`（双路径）
- **Hooks**：✅ 支持（session-start 会话启动钩子）
- **Plugin 注册**：✅ 自动注册到 `.claude-plugin/`
- **平台**：Linux / macOS / Windows

Claude Code 是功能最完整的工具。支持所有 loom 能力，包括会话启动时自动检测项目初始化状态。

### Cursor（full）

- **入口文件**：`.cursorrules`（项目根目录）
- **Skills 发现**：`.loom/skills/`
- **Commands 发现**：`.loom/commands/`
- **Hooks**：✗ 不支持
- **Plugin 注册**：✗ 不支持
- **平台**：Linux / macOS / Windows

Cursor 通过 `.cursorrules` 文件注入工程规范。不支持 hooks 和 plugin 注册。

### GitHub Copilot（full）

- **入口文件**：`.github/copilot-instructions.md`
- **Skills 发现**：`.loom/skills/`
- **Commands 发现**：`.loom/commands/`
- **Hooks**：✗ 不支持
- **Plugin 注册**：✗ 不支持
- **平台**：Linux / macOS / Windows

Copilot 通过 `copilot-instructions.md` 注入工程规范。需要 GitHub Copilot 扩展支持。

### OpenCode（full）

- **入口文件**：`AGENTS.md`（项目根目录）
- **Skills 发现**：`.opencode/skills/` + `.loom/skills/`（双路径）
- **Commands 发现**：`.opencode/commands/` + `.loom/commands/`（双路径）
- **Hooks**：✗ 不支持
- **Plugin 注册**：✅ 自动注册到 `.opencode/`
- **平台**：Linux / macOS / Windows

OpenCode 扫描 `.opencode/skills/` 和 `.opencode/commands/` 发现能力。loom 需要 `.loom/` 统一管理文件（manifest 跟踪、校验和、卸载）。适配器同时写两份：`.opencode/` 供发现，`.loom/` 供管理。

### Codex（planned）

- **入口文件**：`AGENTS.md`
- **状态**：适配器待实现

## 平台兼容性

所有已实现的适配器均支持三个平台：

| 平台 | 安装脚本 | Node.js CLI | Hooks |
|------|----------|-------------|-------|
| Linux | `install.sh` | ✅ | ✅ |
| macOS | `install.sh` | ✅ | ✅ |
| Windows | `install.ps1` | ✅ | ✅ |

### 平台检测逻辑

Hooks 系统通过 `process.platform` 检测平台：

| `process.platform` | 内部标识 |
|---------------------|----------|
| `linux` | `linux` |
| `darwin` | `macos` |
| `win32` | `windows` |

未知平台视为不支持，hook 执行时跳过并输出 warning。

## 功能对比

| 功能 | Claude Code | Cursor | Copilot | OpenCode |
|------|-------------|--------|---------|----------|
| 流水线 Skills | ✅ | ✅ | ✅ | ✅ |
| 项目初始化 | ✅ | ✅ | ✅ | ✅ |
| 代码审查 | ✅ | ✅ | ✅ | ✅ |
| 会话钩子 | ✅ | ✗ | ✗ | ✗ |
| Plugin 注册 | ✅ | ✗ | ✗ | ✅ |
| 入口文件 | CLAUDE.md | .cursorrules | copilot-instructions.md | AGENTS.md |
| Skills 双路径 | ✅ | ✗ | ✗ | ✅ |

## 适配器架构

每个适配器继承 `BaseAdapter`，实现：

- `name` — 工具标识
- `entryFilename` — 入口文件名
- `getTargetFiles(projectRoot)` — 返回所有需要管理的文件路径
- `generate(projectRoot, version, options)` — 生成所有文件

适配器通过 `src/adapters/registry.js` 注册，CLI 通过 `getAdapter(toolId)` 获取。

## 单一事实源

工具定义在 `config/tools.schema.json` 中。修改后运行：

```bash
node scripts/generate-tooling.mjs
```

重新生成 `src/generated/tooling.js`。
