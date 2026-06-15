import { existsSync, readFileSync, writeFileSync } from 'node:fs';

let outOfSync = 0;

export function isCheckMode() {
  return process.env.LOOM_GENERATE_CHECK === '1' || process.argv.includes('--check');
}

export function markOutOfSync(filePath, reason = 'out of sync') {
  console.error(`  ✘ ${filePath} — ${reason}`);
  outOfSync++;
}

export function writeIfChanged(filePath, content, { logUnchanged = true, changedInCheck = false } = {}) {
  const existing = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : '';
  if (existing === content) {
    if (logUnchanged) console.log(`  · ${filePath} — already up to date`);
    return false;
  }

  if (isCheckMode()) {
    markOutOfSync(filePath);
    return changedInCheck;
  }

  writeFileSync(filePath, content, 'utf-8');
  console.log(`  ✔ ${filePath}`);
  return true;
}

export function exitIfOutOfSync() {
  if (outOfSync > 0) process.exit(1);
}
