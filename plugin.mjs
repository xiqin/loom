import { existsSync, readdirSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const _require = createRequire(import.meta.url);
const { checkProject, formatReport } = _require('./hooks/handlers/health-check.cjs');

const PACKAGE_DIR = dirname(fileURLToPath(import.meta.url));
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

// 同步失败不能让整个插件加载失败（例如误把用户主目录当包目录时的 EPERM）。
function syncPackage(packageDir, log) {
  try {
    copySkills(packageDir, log);
    copyCommands(packageDir, log);
    copyTemplates(packageDir, log);
  } catch (err) {
    log.push(`  sync skipped: ${err?.message || err}`);
  }
}

function packageDirFrom(ctx) {
  const override = ctx?.options?.packageDir;
  if (typeof override === 'string' && override) return override;
  return PACKAGE_DIR;
}

function projectRootFrom(ctx, eventDirectory) {
  if (typeof eventDirectory === 'string' && eventDirectory) return eventDirectory;
  const project = ctx?.location?.project;
  return project?.directory || project?.canonical || ctx?.location?.directory || process.cwd();
}

// 兼容 V1 properties 与 V2 data / 外层 payload。
function unwrapEvent(raw) {
  if (raw?.payload && typeof raw.payload.type === 'string') {
    return { event: raw.payload, directory: raw.directory };
  }
  const directory = raw?.location?.directory || raw?.directory;
  return { event: raw, directory };
}

function extractSessionId(event) {
  const payload = event?.properties ?? event?.data ?? {};
  return payload.info?.id ?? payload.sessionID ?? payload.session?.id ?? payload.id ?? event?.sessionID ?? null;
}

// V2 插件上下文没有 tui；测试或未来宿主若注入 showToast 则优先使用。
async function surfaceReport(ctx, lines) {
  if (lines.length === 0) return;
  const message = lines.join('\n');
  try {
    if (typeof ctx?.tui?.showToast === 'function') {
      await ctx.tui.showToast({ message, variant: 'warning', body: { message, variant: 'warning' } });
      return;
    }
  } catch {
    // 回落到日志
  }
  for (const line of lines) console.log(`[loom] ${line}`);
}

async function onSessionEvent(ctx, raw, checkedSessions) {
  const { event, directory } = unwrapEvent(raw);
  if (!event || typeof event.type !== 'string') return;
  if (!event.type.startsWith('session.')) return;

  const sessionId = extractSessionId(event) ?? '__global__';
  if (checkedSessions.has(sessionId)) return;
  checkedSessions.add(sessionId);

  try {
    const result = checkProject(projectRootFrom(ctx, directory));
    await surfaceReport(ctx, formatReport(result));
  } catch {
    // 健康检查永不阻塞会话
  }
}

const plugin = {
  id: 'loom-engineering',
  async setup(ctx) {
    const log = [];
    log.push('Loom plugin initializing...');
    syncPackage(packageDirFrom(ctx), log);

    const checkedSessions = new Set();
    const controller = new AbortController();

    if (typeof ctx?.event?.subscribe === 'function') {
      void (async () => {
        try {
          for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
            await onSessionEvent(ctx, event, checkedSessions);
          }
        } catch (err) {
          if (controller.signal.aborted || err?.name === 'AbortError') return;
        }
      })();
    }

    return () => controller.abort();
  },
};

export default plugin;
