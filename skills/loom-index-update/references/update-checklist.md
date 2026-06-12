# codegraph 与记忆同步检查清单

> **codegraph 唯一图索引原则**：当 codegraph 已初始化（`.codegraph/` 目录存在）时，AI 直接通过 MCP 工具（`codegraph_context`、`codegraph_trace` 等）按需查询实时图。codegraph 不可用时跳过图索引同步。

## 变更检测 → 更新映射

### codegraph 可用

只需确认 codegraph 已同步（`codegraph status`）。无需手动更新任何 Markdown 文件。

| 查询需求 | 使用工具 |
|---------|---------|
| 查找符号定义/上下文 | `codegraph_context` |
| 调用链追踪 | `codegraph_trace` / `codegraph_callers` / `codegraph_callees` |
| 改动影响范围 | `codegraph_impact` |
| 模块/文件结构 | `codegraph_files` |
| 全文搜索 | `codegraph_search` |

### codegraph 不可用

跳过图索引同步，不生成任何 Markdown 索引。需要影响范围分析时使用源码搜索并在报告中注明限制。

### 结构化 Memory

| 事件 | 写入方式 |
|------|----------|
| 发现新坑点 | `loom_add_memory(type="踩坑")` |
| 用户表达偏好 | `loom_add_memory(type="偏好")` |
| 项目重大变更 | `loom_add_memory(type="状态")` |

### {{ENTRY_FILE}}

| 事件 | 需更新的节 |
|------|-----------|
| 新增入口程序 | 入口表 |
| 新增快速命令 | 快速命令 |
| 开发流程变更 | 开发流程 |
| 新增约定 | 对应节 |

## 更新顺序

1. **先检测** — 确认变更范围 + 检测 codegraph 可用性（`.codegraph/` 是否存在）
2. **选择路径**：
   - **codegraph 可用** → `codegraph status` 确认同步，无需更新 Markdown 索引
   - **codegraph 不可用** → 跳过图索引同步
3. **更新 Memory/ENTRY** — 按需
