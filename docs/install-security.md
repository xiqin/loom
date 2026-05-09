# 安装安全

rss 提供多种安装方式，安全等级不同。本文档说明各方式的安全特性和风险。

## 安装方式对比

| 方式 | 代码可见性 | 可审计性 | 可重现性 | 网络依赖 | 适用场景 |
|------|-----------|----------|----------|----------|----------|
| 本地 clone + bash | ✅ 完全可见 | ✅ 可审计 | ✅ 可锁定版本 | ✗ 无需 | 开发环境、安全敏感环境 |
| 本地 clone + PowerShell | ✅ 完全可见 | ✅ 可审计 | ✅ 可锁定版本 | ✗ 无需 | Windows 开发环境 |
| npm 全局安装 | △ 包内容可见 | △ 需审计 npm 包 | ✅ 版本锁定 | ✅ 需要 npm | 日常开发 |
| 远程 curl-pipe | ✗ 直接执行 | ✗ 无法审计 | ✅ 可锁定版本 | ✅ 需要网络 | CI/CD、快速体验 |

## 安装流程安全分析

### 本地 clone 安装

```bash
git clone https://github.com/xiqin/rss.git
cd rss
bash install.sh --tool claude-code
```

**安全特性**：

- 脚本完全可见，可审计每一行
- 支持 `--dry-run` 预览所有将要写入的文件
- 自动检测冲突，冲突文件备份到 `.rss-backup/`
- 写入 `.rss/install-manifest.json` 记录所有文件的 SHA-256 校验和
- 自动更新 `.gitignore` 忽略 `.rss-backup/`

**风险**：

- 需要信任 GitHub 仓库内容
- `npm install` 安装依赖时需要信任 npm registry

### npm 全局安装

```bash
npm i -g rss-engineering
rss init --tool claude-code
```

**安全特性**：

- npm 包版本锁定（`package-lock.json`）
- `rss init` 执行相同的冲突检测和备份逻辑
- 写入 manifest 记录校验和

**风险**：

- 需要信任 npm registry 中的 `rss-engineering` 包
- 全局安装的 CLI 工具对所有项目可用

### 远程 curl-pipe

```bash
curl -fsSL https://raw.githubusercontent.com/xiqin/rss/main/install.sh | bash -s -- --tool claude-code
```

**安全特性**：

- 使用 `--from-release` 时从指定版本 tag 下载，可重现
- 下载后在临时目录解压，安装完成后自动清理
- 支持 `--dry-run` 预览

**风险**：

- **脚本内容不可审计**：直接执行远程内容，用户无法预先检查
- **中间人攻击**：如果 HTTPS 被劫持，可能执行恶意脚本
- **供应链攻击**：如果仓库被入侵，所有用户受影响

**建议**：仅在 CI/CD 或快速体验时使用。生产环境推荐本地 clone。

## 安装前检查

所有安装方式在写入前执行以下检查：

1. **Node.js 版本检查**：要求 >= 18
2. **冲突检测**：扫描所有目标文件，检测是否已存在
3. **rss 管理检测**：检查已有文件是否由 rss 管理（通过版本标记）
4. **版本比较**：已安装版本与待安装版本比较

### 冲突处理

| 情况 | 无 `--force` | 有 `--force` |
|------|-------------|-------------|
| 文件不存在 | 直接写入 | 直接写入 |
| 文件由 rss 管理（同版本） | 跳过，提示已安装 | 覆盖 |
| 文件由 rss 管理（旧版本） | 提示用 `rss update` | 覆盖 |
| 文件存在但非 rss 算理 | 报错，列出冲突 | 备份后覆盖 |

## 安装后验证

```bash
rss doctor    # 检查安装状态
rss list      # 列出已安装的 skills 和 commands
```

`rss doctor` 检查：

- 入口文件是否存在
- `.rss/` 目录结构是否完整
- `install-manifest.json` 是否存在
- 版本号是否一致

## 卸载安全

详见 [recovery.md](recovery.md)。

核心原则：**卸载器不会删除用户修改过的文件**。通过 SHA-256 校验和判断文件是否被修改。

## 备份机制

- 冲突文件自动备份到 `.rss-backup/`
- 备份目录名包含时间戳：`.rss-backup/<timestamp>/`
- 自动保留最近 3 份备份，清理更早的
- `.rss-backup/` 自动加入 `.gitignore`

## Manifest 文件

`.rss/install-manifest.json` 记录：

```json
{
  "version": "1.0.1",
  "tool": "claude-code",
  "filesCreated": ["CLAUDE.md", ".rss/skills/..."],
  "filesUpdated": [],
  "backups": [".rss-backup/20260509-120000/"],
  "hooksInstalled": true,
  "fileChecksums": {
    "CLAUDE.md": "sha256-hex...",
    ".rss/skills/brainstorming/SKILL.md": "sha256-hex..."
  },
  "installedAt": "2026-05-09T12:00:00.000Z"
}
```

校验和用于卸载时判断文件是否被修改。
