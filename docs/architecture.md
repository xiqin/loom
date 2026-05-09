# 架构

rss 项目的代码架构和模块组织。

## 目录结构

```
rss/
├── bin/rss.js              # CLI 入口
├── src/
│   ├── cli.js              # CLI 命令注册（commander）
│   ├── commands/           # CLI 命令实现
│   │   ├── init.js         # rss init
│   │   ├── update.js       # rss update
│   │   ├── doctor.js       # rss doctor
│   │   ├── list.js         # rss list
│   │   └── uninstall.js    # rss uninstall
│   ├── adapters/           # 工具适配器
│   │   ├── base.js         # BaseAdapter 基类
│   │   ├── claude-code.js  # Claude Code 适配器
│   │   ├── cursor.js       # Cursor 适配器
│   │   ├── copilot.js      # Copilot 适配器
│   │   ├── opencode.js     # OpenCode 适配器
│   │   └── registry.js     # 适配器注册表
│   ├── core/               # 核心逻辑
│   │   ├── installer.js    # 安装器
│   │   ├── uninstaller.js  # 卸载器
│   │   ├── manifest.js     # manifest 读写
│   │   └── schema-validator.js  # 模板 schema 验证
│   ├── utils/              # 工具函数
│   │   ├── backup.js       # 备份管理
│   │   ├── conflict.js     # 冲突检测
│   │   └── version.js      # 版本解析与比较
│   └── generated/          # 自动生成
│       └── tooling.js      # 从 tools.schema.json 生成
├── config/                 # Schema 定义
│   ├── tools.schema.json   # 工具定义
│   ├── hooks.schema.json   # Hook 系统定义
│   ├── pipeline.schema.json # 流水线状态机
│   ├── review.schema.json  # 审查框架
│   └── templates.schema.json # 模板定义
├── core/                   # 核心框架文档
│   ├── pipeline.md         # 流水线定义
│   ├── review-framework.md # 审查框架
│   ├── progress-tracker.md # 进度追踪
│   └── subagent-context.md # 子 agent 上下文
├── skills/                 # Skills 定义
├── commands/               # Commands 定义
├── hooks/                  # Hook 系统
│   ├── hooks.json          # Hook 注册表
│   ├── run-hook.js         # Hook runner
│   ├── session-start       # Shell wrapper
│   └── handlers/           # Hook 处理器
│       └── session-start.cjs
├── templates/              # 项目模板
├── plugin-meta/            # 插件元数据
├── scripts/                # 构建脚本
│   ├── generate-tooling.mjs
│   └── sync-version.mjs
└── tests/                  # 测试套件
```

## 核心模块

### CLI 层

```
bin/rss.js → src/cli.js → src/commands/*.js
```

- `bin/rss.js`：Node.js 入口，加载 `src/cli.js`
- `src/cli.js`：使用 commander 注册命令
- `src/commands/`：每个命令一个文件

### 适配器层

```
src/adapters/registry.js → src/adapters/<tool>.js → src/adapters/base.js
```

- `BaseAdapter`：基类，提供 `_copyDirRecursive`、`readAsset`、`_getAssetsDir` 等公共方法
- 每个工具一个适配器，实现 `generate()`、`getTargetFiles()`、`entryFilename`
- `registry.js`：注册表，提供 `getAdapter(id)`、`listAdapters()`

### 核心层

```
src/core/installer.js    — 安装流程
src/core/uninstaller.js  — 卸载流程
src/core/manifest.js     — manifest 读写
src/core/schema-validator.js — 模板验证与渲染
```

**安装流程** (`installer.js`)：

1. 获取适配器和目标文件列表
2. 检测冲突（`conflict.js`）
3. 必要时备份（`backup.js`）
4. 快照文件状态（before）
5. 调用 `adapter.generate()` 生成文件
6. 快照文件状态（after），diff 出 created/updated
7. 更新 `.gitignore`
8. 注册插件（Claude Code）
9. 计算 SHA-256 校验和
10. 写入 manifest

**卸载流程** (`uninstaller.js`)：

1. 读取 manifest
2. 分类文件：safe（未修改）/ modified（已修改）/ missing（已删除）
3. 删除 safe 文件
4. 跳过 modified 文件（输出 warning）
5. 清理空目录
6. 注销插件（Claude Code）
7. 可选：purge 模式清理备份和 .gitignore

### 工具函数层

- `backup.js`：创建备份、清理旧备份（保留最近 3 份）
- `conflict.js`：检测文件冲突状态（不存在/rss-managed/conflict）
- `version.js`：解析 `rss:version=x.y.z` 标记、比较版本号

## 数据流

### 安装数据流

```
CLI (rss init)
  → installer.install({ tool, version, dryRun, force })
    → getAdapter(tool) → adapter
    → adapter.getTargetFiles(projectRoot) → targetFiles
    → detectConflicts(targetFiles) → conflicts
    → createBackup() if conflicts
    → adapter.generate(projectRoot, version)
      → _copyDirRecursive() for each directory
      → writeFileSync() for entry file
    → buildChecksumMap() → checksums
    → writeManifest() → .rss/install-manifest.json
```

### 卸载数据流

```
CLI (rss uninstall)
  → uninstaller.uninstall({ tool, dryRun, purge })
    → readManifest() → manifest
    → classifyFiles(projectRoot, manifest) → { safe, modified, missing }
    → unlinkSync() for safe files
    → cleanupEmptyDirs()
    → unregisterPluginClaude() if claude-code
    → rmSync(.rss-backup/) if purge
    → clean .gitignore if purge
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

rss 使用 JSON Schema 定义配置：

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
├── hooks/          # Hook 系统测试
├── utils/          # 工具函数测试
└── core/           # 核心逻辑测试（待补充）
```

测试框架：vitest。运行：

```bash
npm test            # 运行所有测试
npm run test:watch  # 监听模式
```
