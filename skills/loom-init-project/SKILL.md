---
name: loom-init-project
description: >
  Bootstrap .loom/ context files for a new repository: constitution, project structure, index, memory, workflow.
---

# 项目初始化 Skill

- `.loom/` 是唯一长期维护点，存放项目原则、结构、索引、记忆和 workflow。
- `AGENTS.md` 是 Codex/OpenCode 等通用 agent 的标准入口。
- Claude、Cursor、Copilot 只接收薄 wrapper 或规则副本，避免多处规则漂移。
- 初始化尽量自动化；不确定的信息用 `[TODO]` 标记，交给用户确认。

## 触发条件

用户只需要说 `/loom-init-project`、`初始化项目` 或 `扫描项目生成配置`。

## 内部执行方式

触发本 skill 后，判断当前目录是不是项目根目录，如果不是根目录，询问用户是否在当前目录运行：

如果用户没有明确指定 agent 工具，先询问用户要为哪些工具生成入口文件。可选项为：

- `claude-code`：生成 `AGENTS.md`+ `CLAUDE.md`
- `codex`：生成 `AGENTS.md`
- `opencode`：生成 `AGENTS.md` 并合并 `opencode.json` watcher ignore
- `cursor`：生成 `.cursor/rules/loom.mdc`
- `copilot`：生成 `.github/copilot-instructions.md`

拿到用户选择后，把它们通过 `--tools` 显式传给脚本，例如：

```bash
node <skill-dir>/scripts/init-project.mjs --cwd <project-root> --tools claude-code,codex
```

如果当前环境已安装 loom CLI，也可以等价运行：

```bash
loom init-project
```

可选参数：

- `--force`：覆盖已有 loom 生成文件。
- `--tools claude-code,codex,cursor,copilot,opencode`：显式指定要分发的工具；兼容历史别名 `claude`，不传时 CLI 在交互终端会询问用户，非交互环境会自动检测并默认生成 `AGENTS.md`。
- `--template-dir <path>`：使用指定模板目录，主要用于测试或本地调试；CLI 入口不暴露该参数。

执行后检查输出报告中的 `written` 和 `skipped`。被跳过的文件通常是用户已有的非 loom 管理文件，不要擅自覆盖，除非用户明确同意或使用 `--force`。

## 输出结构

```text
.loom/
  memory/MEMORY.md
  rules/constitution.md
  rules/project-structure.md
  contexts/subagent-context.md
  index/engineering-index.md
  workflow.yaml
AGENTS.md                       # 选择 Codex/OpenCode/Claude Code 时
CLAUDE.md               # 选择 Claude Code 时
.cursor/rules/loom.mdc                  # 检测到 Cursor 时
.cursor/rules/loom-session-init.mdc     # Cursor 等价 session-start hook（新增）
.github/copilot-instructions.md         # 检测到 GitHub Copilot 时
.github/workflows/loom-verify.yml       # 可选：CI 规范门禁（询问用户是否生成）
```

## 人工检查清单

脚本完成后必须快速审阅：

1. `.loom/rules/constitution.md` 中技术栈、构建命令、测试命令是否准确。
2. `.loom/rules/project-structure.md` 中目录树和架构模式是否符合实际项目。
3. 工程索引：codegraph 可用时 `loom init-project` 已自动 `codegraph init` 建图（`.codegraph/` 即索引，engineering-index.md 不再使用）；codegraph 不可用时检查 `.loom/index/engineering-index.md` 是否需要补充路由、模块、公开方法和调用链。
4. `.loom/memory/MEMORY.md` 是否有需要保留的用户偏好、踩坑和长期决策。
5. 入口文件是否轻量：它们应该指向 `.loom/`，不要复制大段规则。

## 约束

- 不修改业务代码。
- 不覆盖用户已有的非 loom 管理文件，除非用户明确要求。
- 生成后不得留下未渲染的 `{{PLACEHOLDER}}`。
- Cursor `.mdc` 必须有合法 frontmatter。
- subagent/并行流程只作为可选执行策略，不作为所有任务的默认要求。

## 完成标准

- 初始化脚本运行成功。
- 输出报告无异常。
- 所有生成文件路径与 `.loom/` 目录结构一致。
- 如存在 `[TODO]`，已明确提示用户后续确认。
