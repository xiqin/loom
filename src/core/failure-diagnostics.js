/**
 * failure-diagnostics.js — 失败诊断与恢复建议
 *
 * 解析 pipeline 失败原因，按分类提供恢复步骤、时间估计、风险等级。
 * 支持安全验证：恢复前检查前置产物和占位符。
 */

import { NodeFileSystem } from './fs-interface.js';
import { join } from 'node:path';
import { hasPlaceholder } from './artifact-checker.js';

// 结构化错误分类
const FAILURE_CATEGORIES = {
  test_failure: {
    keywords: ['test fail', '测试失败', 'expect', 'assertion', 'jest', 'vitest'],
    severity: 'high',
    label: '测试失败',
    recoverySteps: [
      '1. 查看测试失败的具体错误: npm test',
      '2. 修复测试失败的代码',
      '3. 确保所有测试通过',
      '4. 运行 loom run <spec-dir> --next 重新推进'
    ],
    timeEstimate: '5-30 分钟',
    riskLevel: 'low'
  },
  compilation_error: {
    keywords: ['compile', 'syntax', 'error', '编译', '语法', 'type error', 'typescript'],
    severity: 'critical',
    label: '编译错误',
    recoverySteps: [
      '1. 检查编译错误: npm run build',
      '2. 修复类型错误、语法错误',
      '3. 确保代码编译成功',
      '4. 运行 loom run <spec-dir> --next 重新推进'
    ],
    timeEstimate: '5-15 分钟',
    riskLevel: 'low'
  },
  git_conflict: {
    keywords: ['conflict', '冲突', 'merge conflict'],
    severity: 'high',
    label: 'Git 冲突',
    recoverySteps: [
      '1. 查看冲突文件: git status',
      '2. 手动解决冲突',
      '3. 标记已解决: git add <conflicted-files>',
      '4. 提交解决: git commit -m "Resolve conflicts"',
      '5. 运行 loom run <spec-dir> --next 重新推进'
    ],
    timeEstimate: '10-30 分钟',
    riskLevel: 'high'
  },
  timeout: {
    keywords: ['timeout', '超时', 'timed out'],
    severity: 'medium',
    label: '操作超时',
    recoverySteps: [
      '1. 检查网络连接和资源使用情况',
      '2. 增加超时时间或分批处理',
      '3. 运行 loom run <spec-dir> --recover <stage> 重新开始'
    ],
    timeEstimate: '10-20 分钟',
    riskLevel: 'medium'
  },
  permission_denied: {
    keywords: ['permission denied', 'EACCES', '权限'],
    severity: 'medium',
    label: '权限不足',
    recoverySteps: [
      '1. 检查文件权限: ls -la',
      '2. 修复权限: chmod +x <file>',
      '3. 运行 loom run <spec-dir> --next 重新推进'
    ],
    timeEstimate: '2-5 分钟',
    riskLevel: 'low'
  },
  precondition_not_met: {
    keywords: ['precondition', 'missing', '缺少产物', 'not initialized'],
    severity: 'high',
    label: '前置条件不满足',
    recoverySteps: [
      '1. 确认前置产物是否完整',
      '2. 若产物缺失，回滚到前置阶段重新执行',
      '3. 运行 loom run <spec-dir> --recover <前置阶段>'
    ],
    timeEstimate: '5-15 分钟',
    riskLevel: 'medium'
  }
};

const STAGE_PREREQUISITES = {
  planning: ['spec.md'],
  executing: ['plan.md'],
  verification: ['test-report.md']
};

const STAGE_OUTPUTS = {
  brainstorming: ['spec.md'],
  planning: ['plan.md'],
  executing: ['test-report.md'],
  verification: ['verification-report.md']
};

export class FailureDiagnostics {
  constructor(specDir, { fs } = {}) {
    this.specDir = specDir;
    this.fs = fs || new NodeFileSystem();
  }

  /**
   * 诊断失败的根本原因
   * @param {string} failureReason
   * @returns {{ categories: object[], summary: string }}
   */
  diagnose(failureReason) {
    const categories = [];
    const reasonLower = (failureReason || '').toLowerCase();

    for (const [key, cat] of Object.entries(FAILURE_CATEGORIES)) {
      if (cat.keywords.some(kw => reasonLower.includes(kw))) {
        categories.push({ category: key, ...cat });
      }
    }

    if (categories.length === 0) {
      categories.push({
        category: 'unknown',
        severity: 'medium',
        label: '未知错误',
        recoverySteps: [
          '1. 查看完整错误信息和日志',
          '2. 根据错误调查并修复问题',
          '3. 运行 loom run <spec-dir> --next 重新推进'
        ],
        timeEstimate: '15-60 分钟',
        riskLevel: 'high'
      });
    }

    const summary = categories.some(c => c.severity === 'critical')
      ? `严重问题，建议立即修复`
      : categories.some(c => c.severity === 'high')
      ? `需要修复后重试`
      : `可能影响推进，建议检查`;

    return { categories, summary };
  }

  /**
   * 生成恢复步骤
   * @param {string} failureReason
   * @returns {{ steps: string[], timeEstimate: string, riskLevel: string, category: string }}
   */
  suggestRecovery(failureReason) {
    const { categories } = this.diagnose(failureReason);
    const top = categories[0];

    return {
      category: top.category,
      steps: top.recoverySteps,
      timeEstimate: top.timeEstimate,
      riskLevel: top.riskLevel
    };
  }

  /**
   * 验证恢复是否安全
   * @param {string} nextStage 目标阶段
   * @returns {{ safe: boolean, blockers: string[], warnings: string[] }}
   */
  verifyRecoverySafety(nextStage) {
    const blockers = [];
    const warnings = [];

    // 检查前置产物
    const prereqs = STAGE_PREREQUISITES[nextStage] || [];
    for (const prereq of prereqs) {
      if (!this.fs.existsSync(join(this.specDir, prereq))) {
        blockers.push(`前置产物缺失: ${prereq}`);
      }
    }

    // 检查已有产物是否含占位符
    const outputs = STAGE_OUTPUTS[nextStage] || [];
    for (const output of outputs) {
      const path = join(this.specDir, output);
      if (this.fs.existsSync(path)) {
        const content = this.fs.readFileSync(path, 'utf-8');
        if (hasPlaceholder(content)) {
          warnings.push(`${output} 包含未完成标记`);
        }
      }
    }

    return {
      safe: blockers.length === 0,
      blockers,
      warnings,
      summary: blockers.length > 0
        ? `有 ${blockers.length} 个阻塞问题，无法安全推进`
        : warnings.length > 0
        ? `有 ${warnings.length} 个警告，但可以尝试推进`
        : '可以安全推进'
    };
  }
}
