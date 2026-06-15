import { existsSync, readFileSync, renameSync, rmSync } from 'node:fs';

export function backupConfigFile(filePath, log, label) {
  const backupPath = `${filePath}.bak`;
  try {
    rmSync(backupPath, { recursive: true, force: true });
    renameSync(filePath, backupPath);
    log.push(`  ${label}: 已备份至 ${backupPath}`);
    return true;
  } catch (err) {
    log.push(`  ${label}: 备份失败 (${err.message})`);
    return false;
  }
}

export function readJsonConfig(filePath, { log, label, name }) {
  if (!existsSync(filePath)) return {};

  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (err) {
    log.push(`  ${label}: ${name} 解析失败 (${err.message})，将备份并重建`);
    backupConfigFile(filePath, log, label);
    return {};
  }
}

export function readTextConfig(filePath, { log, label, name }) {
  if (!existsSync(filePath)) return '';

  try {
    return readFileSync(filePath, 'utf-8');
  } catch (err) {
    log.push(`  ${label}: ${name} 读取失败 (${err.message})，将备份并重建`);
    backupConfigFile(filePath, log, label);
    return '';
  }
}
