import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BaseAdapter } from './base.js';
import { injectVersion } from '../utils/version.js';

export class CursorAdapter extends BaseAdapter {
  get name() {
    return 'cursor';
  }

  get entryFilename() {
    return '.cursorrules';
  }

  getTargetFiles(projectRoot) {
    return [join(projectRoot, '.cursorrules')];
  }

  async generate(projectRoot, version, options = {}) {
    const content = this._buildContent();
    const versioned = injectVersion(content, version, 'text');
    writeFileSync(join(projectRoot, '.cursorrules'), versioned);
  }

  _buildContent() {
    const pipeline = this.readAsset('core/pipeline.md');

    return `.cursorrules (由 loom-engineering 自动生成)

# ===== 核心流水线 =====

${this._extractSection(pipeline, '5 步流水线')}

# ===== Skills 流程摘要 =====

## brainstorming — 需求头脑风暴
- 触发：用户提出需求、功能描述、PRD
- 流程：读取宪章 → 探索 2-3 种方案及 trade-off → 输出 spec.md → 等待用户确认
- 输出：specs/<date+feature>/spec.md

## writing-plans — 计划拆解
- 触发：spec.md 已存在且用户已确认
- 流程：按 Model → Service → Controller → Router 分层拆分 task
- 输出：specs/<date+feature>/plan.md

## subagent-driven-development — 编码执行
- 触发：plan.md 已存在
- 流程：每 task 派发 implementer + reviewer（spec + quality 审查）
- 关键：subagent 互不继承上下文，绝不跳过审查

## index-update — 工程索引同步
- 触发：所有测试通过
- 流程：更新 ENGINEERING-INDEX.md

# ===== 开发原则 =====

1. 先思考，再编码 — 显式声明假设，不确定时提问
2. 极简优先 — 只写解决问题的最小代码
3. 精准手术 — 只改动必须改动的部分
4. 目标驱动 — 将模糊任务转化为可验证的成功标准

## --- USER CUSTOM ---
# 在此添加项目自定义规则，loom update 时不覆盖此区域
`;
  }

  _extractSection(content, heading) {
    const lines = content.split('\n');
    const startIdx = lines.findIndex(l => l.includes(heading));
    if (startIdx === -1) return content.slice(0, 500);

    let endIdx = lines.length;
    for (let i = startIdx + 1; i < lines.length; i++) {
      if (lines[i].startsWith('## ') && !lines[i].includes(heading)) {
        endIdx = i;
        break;
      }
    }
    return lines.slice(startIdx, endIdx).join('\n');
  }
}
