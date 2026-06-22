import { resolve } from 'node:path';
import { PipelineSelector } from '../core/pipeline-selector.js';

export default async function select(options) {
  const cwd = options.cwd || process.cwd();
  const absSpecDir = resolve(cwd, options.specDir);

  const selector = new PipelineSelector(cwd, absSpecDir);
  const selection = await selector.select(options.request);

  const ids = selection.steps.map(s => s.id);

  if (options.json) {
    console.log(JSON.stringify(selection, null, 2));
    return;
  }

  const { path } = selector.writePipelinePlan(selection);
  console.log(`\n  ✓ 选择完成（${selection.source}, 风险: ${selection.risk}）`);
  console.log(`  Steps: ${ids.join(' → ')}`);
  console.log(`  Plan:  ${path}`);
  console.log(`\n  确认方案：loom run --spec-dir ${options.specDir} --approve-pipeline\n`);
}
