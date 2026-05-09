# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- 建立 config/tools.schema.json 作为工具定义单一事实源
- 新建 scripts/generate-tooling.mjs 生成 src/generated/tooling.js
- 新建 scripts/sync-version.mjs 同步版本号到所有元数据文件
- plugin-meta/*.json 版本号从 sync-version.mjs 自动同步
- install/uninstall 脚本远程下载改为锁定版本 tag，不再拉取 main

## [1.0.1] - 2026-05-09

### Added
- 支持多种安装方式（本地 / 远程 curl-pipe / npm link）
- CLI 命令：init, update, doctor, uninstall, list
- 适配器：claude-code, cursor, copilot, opencode
- Skills 系统（16 个 skills）
- Hooks 系统（session-start）
- Plugin 注册（Claude Code, OpenCode）
- 测试套件（vitest, 64 tests）

## [1.0.0] - 2026-04-26

### Added
- 初始版本

[Unreleased]: https://github.com/xiqin/rss/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/xiqin/rss/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/xiqin/rss/releases/tag/v1.0.0
