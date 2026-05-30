# loom 安装指南

## 前置条件

- Node.js >= 18
- Git（本地安装方式需要）

## 方式一：一键安装脚本

```bash
git clone https://github.com/xiqin/loom.git
cd loom
bash install.sh --tool claude-code
```

### 远程安装

```bash
# Unix
curl -fsSL https://raw.githubusercontent.com/xiqin/loom/main/install.sh | bash -s -- --tool claude-code

# Windows PowerShell
irm https://raw.githubusercontent.com/xiqin/loom/main/install.ps1 -OutFile install.ps1; .\install.ps1 -Tool claude-code
```

### 安装多个工具

```bash
bash install.sh --tool claude-code --tool cursor --tool opencode
```

## 方式二：npm 全局安装

```bash
npm i -g loom-engineering
loom install --tool claude-code
```

## 选项参考

| Flag              | 作用                                                            |
| ----------------- | --------------------------------------------------------------- |
| `--tool <target>` | 目标工具（必填，可重复）：claude-code, opencode, cursor, copilot, codex |
| `--dry-run`       | 预览安装文件，不实际写入                                        |
| `--from-release`  | 从 GitHub release tag 下载（可重现安装）                        |
| `--version <ver>` | 指定下载版本（配合 `--from-release` 使用）                      |

## 安装后验证

```bash
loom doctor    # 诊断安装状态
loom list      # 列出可用 skills 和 commands
```

工具将在下次会话中自动发现 loom 的 skills 和 commands。

## 在项目中初始化

安装是用户级（全局）的。要在某个仓库中使用 loom 的流水线与上下文，需在该仓库根目录初始化：

```bash
cd your-project
loom init-project                       # 生成 .loom/ 上下文（宪章、工程结构、记忆等）
loom init-project --tools claude-code   # 指定写入哪些工具的项目级配置
loom init-project --force               # 覆盖已存在的 loom 托管文件
```

## 卸载

```bash
bash uninstall.sh --tool claude-code
# 或
loom uninstall --tool claude-code
```

卸载只清理用户目录下由 loom 生成的文件，不碰项目中的任何文件。

## 支持的 tools

| Tool ID     | 工具名称       | skills | commands | plugin 注册 |
| ----------- | -------------- | ------ | -------- | ----------- |
| claude-code | Claude Code    | ✓      | ✓        | ✓           |
| opencode    | OpenCode       | ✓      | ✓        | ✓           |
| cursor      | Cursor         | ✓      | ✓        | ✗           |
| copilot     | GitHub Copilot | ✓      | ✓        | ✗           |
| codex       | Codex CLI      | ✓      | ✗        | ✗           |
