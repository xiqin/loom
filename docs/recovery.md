# 卸载与恢复

rss 提供安全的卸载机制，确保不会丢失用户数据。

## 卸载方式

### 脚本卸载

```bash
# Unix
bash uninstall.sh --tool claude-code

# Windows
.\uninstall.ps1 -Tool claude-code
```

### CLI 卸载

```bash
rss uninstall --tool claude-code
```

### 卸载选项

| Flag | 作用 |
|------|------|
| `--tool <target>` | 目标工具（必填） |
| `--dry-run` | 预览删除文件，不实际执行 |
| `--purge` | 额外清理备份目录和 .gitignore 条目 |
| `--from-release` | 从 GitHub release tag 下载（可重现卸载） |
| `--version <ver>` | 指定版本 |

## 卸载安全策略

### 文件分类

卸载器读取 `.rss/install-manifest.json`，将文件分为三类：

| 分类 | 判断条件 | 卸载行为 |
|------|----------|----------|
| **safe** | 当前 SHA-256 与 manifest 记录一致 | 安全删除 |
| **modified** | 当前 SHA-256 与 manifest 记录不一致 | 跳过，输出 warning |
| **missing** | 文件已不存在 | 跳过 |

### 校验和机制

安装时，每个生成的文件都会计算 SHA-256 校验和，记录在 manifest 中：

```json
{
  "fileChecksums": {
    "CLAUDE.md": "a1b2c3d4...",
    ".rss/skills/brainstorming/SKILL.md": "e5f6g7h8..."
  }
}
```

卸载时重新计算每个文件的 SHA-256，与 manifest 比较：

- **一致** → 文件未被修改 → 安全删除
- **不一致** → 文件被用户修改 → 跳过
- **文件不存在** → 已被手动删除 → 跳过

### 无 manifest 情况

如果 `.rss/install-manifest.json` 不存在，卸载器拒绝执行：

```
No manifest found (.rss/install-manifest.json).
Cannot safely uninstall without manifest.
```

此时需要手动删除 `.rss/` 目录和入口文件。

### 旧版 manifest（无校验和）

如果 manifest 中没有 `fileChecksums` 字段（旧版本安装），所有文件视为 `modified`，不会被删除。需要手动清理或重新安装后卸载。

## 卸载流程

```
1. 读取 .rss/install-manifest.json
2. 验证 manifest.tool 与请求的 tool 一致
3. 遍历 manifest 中的所有文件
4. 对每个文件：
   a. 不存在 → 标记为 missing
   b. SHA-256 匹配 → 标记为 safe
   c. SHA-256 不匹配 → 标记为 modified
5. 删除所有 safe 文件
6. 清理空目录（向上递归直到项目根目录）
7. 删除 .rss/install-manifest.json
8. 删除 .rss/ 空子目录
9. 如果是 Claude Code：注销插件
10. 如果 --purge：
    a. 删除 .rss-backup/ 目录
    b. 清理 .gitignore 中的 rss 条目
```

## Purge 模式

`--purge` 额外清理：

| 清理项 | 说明 |
|--------|------|
| `.rss-backup/` | 删除所有备份文件 |
| `.gitignore` rss 条目 | 移除 `# rss-engineering` 注释和 `.rss-backup/` 行 |

**注意**：`--purge` 也不能越过 manifest 边界。它只清理 rss 管理的备份和 .gitignore 条目，不会删除用户修改过的文件。

## 恢复策略

### 误卸载恢复

如果误卸载，重新安装即可：

```bash
rss init --tool claude-code
```

重新安装会生成所有文件。之前运行 `/rss-init-project` 生成的文件（constitution.md、MEMORY.md 等）不受影响，因为它们不在 rss 的安装 manifest 中。

### 恢复被 --force 覆盖的文件

安装时使用 `--force` 会将冲突文件备份到 `.rss-backup/`：

```bash
ls .rss-backup/                    # 查看备份目录
ls .rss-backup/20260509-120000/    # 查看具体备份
cp .rss-backup/20260509-120000/CLAUDE.md .  # 恢复文件
```

备份目录结构：

```
.rss-backup/
├── 20260509-120000/    # 时间戳目录
│   ├── CLAUDE.md
│   └── .rss/
│       └── skills/
└── 20260508-150000/    # 更早的备份
    └── ...
```

### 手动清理

如果 manifest 丢失或损坏，手动清理：

```bash
# 删除 .rss 目录
rm -rf .rss/

# 删除入口文件
rm CLAUDE.md              # Claude Code
rm AGENTS.md              # OpenCode
rm .cursorrules           # Cursor
rm -rf .github/copilot-instructions.md  # Copilot

# 删除插件元数据
rm -rf .claude-plugin/    # Claude Code
rm -rf .opencode/         # OpenCode

# 删除 Claude Code 发现路径
rm -rf skills/ commands/

# 清理 .gitignore
# 手动编辑 .gitignore，移除 rss 相关行
```

## 备份管理

### 自动备份

- 安装时检测到冲突文件，自动备份到 `.rss-backup/<timestamp>/`
- 自动保留最近 3 份备份，清理更早的
- `.rss-backup/` 自动加入 `.gitignore`

### 手动备份

```bash
# 查看备份
ls .rss-backup/

# 恢复特定文件
cp .rss-backup/<timestamp>/CLAUDE.md .

# 删除所有备份
rm -rf .rss-backup/
```

## 常见问题

### Q: 卸载后 constitution.md 还在吗？

A: 在。`constitution.md` 由 `/rss-init-project` 生成，不在 rss 安装 manifest 中，卸载时不会被删除。

### Q: 卸载后 MEMORY.md 还在吗？

A: 在。同上，`MEMORY.md` 由 `/rss-init-project` 生成。

### Q: 修改了 CLAUDE.md 后卸载会怎样？

A: CLAUDE.md 会被跳过（modified），不会被删除。输出 warning 提示。

### Q: 没有 manifest 怎么办？

A: 卸载器拒绝执行。需要手动删除或重新安装后再卸载。

### Q: 如何完全清理 rss 痕迹？

A: 使用 `--purge` 模式卸载，然后手动删除 `/rss-init-project` 生成的文件（constitution.md、MEMORY.md、project-structure.md、rss.md）。
