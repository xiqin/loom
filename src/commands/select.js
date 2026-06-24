import { PipelineSelector } from '../core/pipeline-selector.js';
import { resolvePipelineDir } from '../core/spec-dir.js';

export default async function select(options) {
  const cwd = options.cwd || process.cwd();
  let absSpecDir;
  try {
    absSpecDir = resolvePipelineDir(cwd, options.specDir);
  } catch (err) {
    console.error(`\n  ✗ ${err.message}\n`);
    process.exitCode = 1;
    return;
  }

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
