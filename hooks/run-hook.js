import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const _require = createRequire(import.meta.url);

/**
 * Detect current platform.
 * @returns {'linux'|'macos'|'windows'|'unknown'}
 */
export function detectPlatform() {
  const map = { linux: 'linux', darwin: 'macos', win32: 'windows' };
  return map[process.platform] ?? 'unknown';
}

/**
 * Load hook definitions from hooks.json.
 * @param {string} [hooksDir] - Directory containing hooks.json (default: __dirname)
 * @returns {Array<object>}
 */
export function loadHooks(hooksDir = __dirname) {
  const raw = readFileSync(join(hooksDir, 'hooks.json'), 'utf-8');
  return JSON.parse(raw);
}

/**
 * Find hook by id.
 * @param {Array<object>} hooks
 * @param {string} hookId
 * @returns {object|null}
 */
export function findHook(hooks, hookId) {
  return hooks.find(h => h.id === hookId) ?? null;
}

/**
 * Check if hook supports current platform.
 * @param {object} hook
 * @param {string} platform
 * @returns {boolean}
 */
export function supportsPlatform(hook, platform) {
  if (!hook.platforms || hook.platforms.length === 0) return true;
  return hook.platforms.includes(platform);
}

/**
 * Execute function with timeout.
 * @param {Function} fn - Async function to execute
 * @param {number} timeoutMs - Timeout in ms (0 = no timeout)
 * @returns {Promise<{ok: boolean, timedOut: boolean, error?: Error}>}
 */
export async function withTimeout(fn, timeoutMs) {
  if (timeoutMs <= 0) {
    try {
      await fn();
      return { ok: true, timedOut: false };
    } catch (error) {
      return { ok: false, timedOut: false, error };
    }
  }

  let timer;
  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('HOOK_TIMEOUT')), timeoutMs);
      }),
    ]);
    return { ok: true, timedOut: false };
  } catch (error) {
    return {
      ok: false,
      timedOut: error.message === 'HOOK_TIMEOUT',
      error,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve log function for fallback strategy.
 */
function logForStrategy(strategy, hookId) {
  const prefix = `[loom:hook:${hookId}]`;
  switch (strategy) {
    case 'skip':
      return (msg) => console.debug(`${prefix} ${msg}`);
    case 'warn':
      return (msg) => console.warn(`${prefix} WARNING: ${msg}`);
    case 'error':
    case 'retry':
      return (msg) => console.error(`${prefix} ERROR: ${msg}`);
    default:
      return (msg) => console.log(`${prefix} ${msg}`);
  }
}

/**
 * Run a single hook by id.
 *
 * @param {string} hookId
 * @param {object} [options]
 * @param {string} [options.hooksDir] - Directory containing hooks.json and handlers/
 * @param {string} [options.platform] - Override platform detection
 * @returns {Promise<{hookId: string, status: string, message?: string}>}
 */
export async function runHook(hookId, options = {}) {
  const hooksDir = options.hooksDir ?? __dirname;
  const platform = options.platform ?? detectPlatform();
  const hooks = loadHooks(hooksDir);
  const hook = findHook(hooks, hookId);

  if (!hook) {
    return { hookId, status: 'skipped', message: `Hook "${hookId}" not found in hooks.json` };
  }

  // Platform check
  if (!supportsPlatform(hook, platform)) {
    const log = logForStrategy('warn', hookId);
    log(`Platform "${platform}" not supported (requires: ${hook.platforms.join(', ')}). Skipping.`);
    return { hookId, status: 'skipped', message: `Platform "${platform}" not supported` };
  }

  const fallback = hook.fallback ?? 'warn';
  const retryCount = hook.retryCount ?? 2;
  const log = logForStrategy(fallback, hookId);

  // Load handler
  let handler;
  try {
    const handlerPath = join(hooksDir, hook.entry);
    const mod = _require(handlerPath);
    handler = mod.run ?? mod.default ?? mod;
  } catch (error) {
    log(`Failed to load handler "${hook.entry}": ${error.message}`);
    return { hookId, status: 'failed', message: `Handler load error: ${error.message}` };
  }

  if (typeof handler !== 'function') {
    log(`Handler "${hook.entry}" does not export a function`);
    return { hookId, status: 'failed', message: 'Handler is not a function' };
  }

  // Execute with retry logic
  const maxAttempts = fallback === 'retry' ? retryCount + 1 : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      log(`Retry ${attempt}/${retryCount}...`);
      await new Promise(r => setTimeout(r, 500));
    }

    const result = await withTimeout(() => handler(), hook.timeoutMs);

    if (result.ok) {
      return { hookId, status: 'ok' };
    }

    if (result.timedOut) {
      log(`Execution timed out after ${hook.timeoutMs}ms`);
    } else {
      log(`Execution failed: ${result.error?.message}`);
    }
  }

  // All attempts failed — apply fallback
  switch (fallback) {
    case 'skip':
      return { hookId, status: 'skipped', message: 'Failed, skipped per fallback policy' };
    case 'warn':
      return { hookId, status: 'warned', message: 'Failed, warned per fallback policy' };
    case 'error':
    case 'retry':
      return { hookId, status: 'failed', message: `Failed after ${maxAttempts} attempt(s)` };
    default:
      return { hookId, status: 'warned', message: 'Failed, unknown fallback' };
  }
}

/**
 * CLI entry point: node run-hook.js <hook-id>
 */
const isMain = process.argv[1] &&
  (process.argv[1].endsWith('run-hook.js') || process.argv[1].endsWith('run-hook'));

if (isMain) {
  const hookId = process.argv[2];
  if (!hookId) {
    console.error('Usage: node run-hook.js <hook-id>');
    process.exit(1);
  }

  const result = await runHook(hookId);

  if (result.status === 'failed') {
    console.error(`Hook "${hookId}" failed: ${result.message}`);
    process.exit(1);
  }

  if (result.status === 'skipped' && result.message?.includes('not found')) {
    console.warn(`Hook "${hookId}" not found`);
    process.exit(1);
  }
}
