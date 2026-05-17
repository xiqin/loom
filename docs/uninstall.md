# loom 卸载

## 卸载

```bash
# 脚本卸载
bash uninstall.sh --tool claude-code

# CLI 卸载
loom uninstall --tool claude-code
```

### 卸载内容

卸载会移除以下内容（取决于目标工具）：

| 位置                                 | 说明                               |
| ------------------------------------ | ---------------------------------- |
| `~/.config/opencode/commands/`       | OpenCode commands                  |
| `~/.cursor/rules/`                   | Cursor `.mdc` 规则文件             |
| `~/.copilot/skills/`                 | Copilot skills                     |
| `~/.copilot/copilot-instructions.md` | Copilot 全局指令                   |
| `~/.codex/skills/`                   | Codex skills                       |
| Plugin 注册                          | Claude Code / OpenCode plugin 注册 |

### 不涉及的范围

卸载**不会**触及：

- 任何项目目录下的文件
- 非 loom 生成的文件
- 用户主目录下非 loom 管理的文件

### Dry-run 预览

```bash
loom uninstall --tool claude-code --dry-run
```

预览模式显示将删除的文件和目录，不实际执行。
