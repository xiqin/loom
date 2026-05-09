import { readFileSync, writeFileSync, existsSync, appendFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseVersion } from './version.js';

export function detectConflicts(targetFiles) {
  const conflicts = [];

  for (const file of targetFiles) {
    if (!existsSync(file)) continue;

    const stat = statSync(file);
    if (stat.isDirectory()) continue;

    const content = readFileSync(file, 'utf-8');
    const version = parseVersion(content);

    if (version) {
      conflicts.push({ file, status: 'rss-managed', version });
    } else {
      conflicts.push({ file, status: 'conflict', reason: 'File exists without rss version marker' });
    }
  }

  return conflicts;
}

export function ensureGitignore(projectRoot) {
  const gitignorePath = join(projectRoot, '.gitignore');
  const marker = '.rss-backup/';

  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf-8');
    if (content.includes(marker)) return;
    appendFileSync(gitignorePath, `\n# rss-engineering\n${marker}\n`);
  } else {
    writeFileSync(gitignorePath, `# rss-engineering\n${marker}\n`);
  }
}
