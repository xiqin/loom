import { isAbsolute, relative, resolve, sep } from 'node:path';

const ALLOWED_PIPELINE_ROOTS = new Set(['specs', 'qa']);

export function resolvePipelineDir(projectRoot, specDir) {
  if (!specDir) throw new Error('spec_dir is required');

  const root = resolve(projectRoot);
  const abs = resolve(root, specDir);
  const rel = relative(root, abs);

  if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`spec_dir escapes project root or points at project root: ${specDir}`);
  }

  const parts = rel.split(sep).filter(Boolean);
  if (parts.length < 2 || !ALLOWED_PIPELINE_ROOTS.has(parts[0])) {
    throw new Error(`spec_dir must be specs/<name> or qa/<name>, got: ${specDir}`);
  }

  return abs;
}
