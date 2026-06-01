import { existsSync, readdirSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';

const _require = createRequire(import.meta.url);
const { checkProject, formatReport } = _require('./hooks/handlers/health-check.cjs');

const USER_DIR = join(homedir(), '.config', 'opencode');
const SKILLS_DIR = join(USER_DIR, 'skills');
const COMMANDS_DIR = join(USER_DIR, 'commands');
const MANAGED_SKILL_PREFIX = 'loom-';
const MANAGED_COMMAND_PREFIX = 'loom-';

function copySkills(packageDir, log) {
  const src = join(packageDir, 'skills');
  if (!existsSync(src)) return;

  mkdirSync(SKILLS_DIR, { recursive: true });

  const srcNames = new Set();
  let count = 0;
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillDir = join(src, entry.name);
    const skillMd = join(skillDir, 'SKILL.md');
    if (!existsSync(skillMd)) continue;
    srcNames.add(entry.name);
    cpSync(skillDir, join(SKILLS_DIR, entry.name), { recursive: true, force: true });
    count++;
  }

  if (existsSync(SKILLS_DIR)) {
    for (const entry of readdirSync(SKILLS_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (srcNames.has(entry.name)) continue;
      if (!entry.name.startsWith(MANAGED_SKILL_PREFIX)) continue;
      rmSync(join(SKILLS_DIR, entry.name), { recursive: true, force: true });
      log.push(`  skills: removed stale ${entry.name}`);
    }
  }

  log.push(`  skills: ${count} copied → ${SKILLS_DIR}`);
}

function copyCommands(packageDir, log) {
  const src = join(packageDir, 'commands');
  if (!existsSync(src)) return;

  mkdirSync(COMMANDS_DIR, { recursive: true });

  const srcNames = new Set();
  let count = 0;
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    srcNames.add(entry.name);
    cpSync(join(src, entry.name), join(COMMANDS_DIR, entry.name), { force: true });
    count++;
  }

  if (existsSync(COMMANDS_DIR)) {
    for (const entry of readdirSync(COMMANDS_DIR, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      if (srcNames.has(entry.name)) continue;
      if (!entry.name.startsWith(MANAGED_COMMAND_PREFIX)) continue;
      rmSync(join(COMMANDS_DIR, entry.name), { force: true });
      log.push(`  commands: removed stale ${entry.name}`);
    }
  }

  log.push(`  commands: ${count} copied → ${COMMANDS_DIR}`);
}

function copyTemplates(packageDir, log) {
  const src = join(packageDir, 'templates');
  if (!existsSync(src)) return;

  const initProjectDir = join(SKILLS_DIR, 'loom-init-project');
  if (!existsSync(initProjectDir)) {
    log.push('  templates: loom-init-project skill not found, skipped');
    return;
  }

  const dest = join(initProjectDir, 'templates');
  cpSync(src, dest, { recursive: true, force: true });
  log.push('  templates: copied to loom-init-project skill dir');
}

// 把检查结果推给用户。优先 OpenCode toast（用户可见），失败回落到 console。
async function surfaceReport(client, lines) {
  if (lines.length === 0) return;
  const message = lines.join('\n');
  try {
    if (client?.tui?.showToast) {
      await client.tui.showToast({ body: { message, variant: 'warning' } });
      return;
    }
  } catch {}
  // 回落：写进 OpenCode 插件日志
  for (const line of lines) console.log(`[loom] ${line}`);
}

// 提取 session id，兼容多种 event payload 结构。
function extractSessionId(event) {
  const p = event?.properties ?? {};
  return p.info?.id ?? p.sessionID ?? p.session?.id ?? p.id ?? null;
}

export const Plugin = async ({ directory, worktree, client }) => {
  const log = [];
  log.push(`Loom plugin initializing...`);

  copySkills(directory, log);
  copyCommands(directory, log);
  copyTemplates(directory, log);

  // OpenCode 原生 hook：等价 Claude Code 的 session-start。
  // 每个 session 首次活动时跑一次 loom 项目健康检查并提示用户。
  const projectRoot = worktree || directory || process.cwd();
  const checkedSessions = new Set();

  return {
    event: async ({ event }) => {
      if (!event || typeof event.type !== 'string') return;
      if (!event.type.startsWith('session.')) return;

      const sessionId = extractSessionId(event) ?? '__global__';
      if (checkedSessions.has(sessionId)) return;
      checkedSessions.add(sessionId);

      try {
        const result = checkProject(projectRoot);
        await surfaceReport(client, formatReport(result));
      } catch {
        // 健康检查永不阻塞会话
      }
    },
  };
};
