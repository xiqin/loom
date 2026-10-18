import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import plugin from '../../plugin.mjs';

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), 'loom-ocplugin-test-'));
}

function uninitializedProject() {
  const dir = makeTempDir();
  writeFileSync(join(dir, 'package.json'), '{}');
  return dir;
}

function harness(project, events, { toast = true } = {}) {
  const showToast = vi.fn().mockResolvedValue(undefined);
  let markDone;
  const done = new Promise((resolve) => {
    markDone = resolve;
  });
  const ctx = {
    location: {
      directory: project,
      project: { directory: project },
    },
    options: { packageDir: makeTempDir() },
    event: {
      subscribe() {
        return (async function* () {
          for (const event of events) yield event;
          markDone();
        })();
      },
    },
  };
  if (toast) ctx.tui = { showToast };
  return { ctx, showToast, done };
}

describe('OpenCode V2 plugin', () => {
  it('exports a default definition with id and setup', () => {
    expect(plugin.id).toBe('loom-engineering');
    expect(typeof plugin.setup).toBe('function');
  });

  it('runs health check once per session on session events', async () => {
    const project = uninitializedProject();
    const event = { type: 'session.updated', properties: { info: { id: 's1' } } };
    const { ctx, showToast, done } = harness(project, [event, event]);

    const cleanup = await plugin.setup(ctx);
    await done;

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast.mock.calls[0][0].message).toContain('项目未初始化');
    cleanup();
  });

  it('reads V2 session event data', async () => {
    const project = uninitializedProject();
    const event = { type: 'session.created', data: { sessionID: 's2' } };
    const { ctx, showToast, done } = harness(project, [event, event]);

    const cleanup = await plugin.setup(ctx);
    await done;

    expect(showToast).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('ignores non-session events', async () => {
    const { ctx, showToast, done } = harness(uninitializedProject(), [
      { type: 'message.updated', properties: {} },
    ]);

    const cleanup = await plugin.setup(ctx);
    await done;

    expect(showToast).not.toHaveBeenCalled();
    cleanup();
  });

  it('stays silent for a healthy project', async () => {
    const project = uninitializedProject();
    mkdirSync(join(project, '.loom', 'memory'), { recursive: true });
    writeFileSync(join(project, '.loom', 'memory', 'constitution.md'), '# c');
    writeFileSync(join(project, '.loom', 'workflow.yaml'), 'version: 1');

    const { ctx, showToast, done } = harness(project, [
      { type: 'session.updated', properties: { info: { id: 's1' } } },
    ]);

    const cleanup = await plugin.setup(ctx);
    await done;

    expect(showToast).not.toHaveBeenCalled();
    cleanup();
  });

  it('falls back to console when toast unavailable', async () => {
    const project = uninitializedProject();
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { ctx, done } = harness(project, [
      { type: 'session.idle', data: { sessionID: 's9' } },
    ], { toast: false });

    const cleanup = await plugin.setup(ctx);
    await done;

    expect(spy.mock.calls.some((call) => String(call[0]).includes('项目未初始化'))).toBe(true);
    spy.mockRestore();
    cleanup();
  });
});
