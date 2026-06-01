import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Plugin } from '../../plugin.mjs';

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), 'loom-ocplugin-test-'));
}

function uninitializedProject() {
  const dir = makeTempDir();
  writeFileSync(join(dir, 'package.json'), '{}');
  return dir;
}

function mockClient() {
  const showToast = vi.fn().mockResolvedValue(undefined);
  return { client: { tui: { showToast } }, showToast };
}

describe('OpenCode plugin event hook', () => {
  it('registers an event hook', async () => {
    const { client } = mockClient();
    const hooks = await Plugin({ directory: makeTempDir(), worktree: uninitializedProject(), client });
    expect(typeof hooks.event).toBe('function');
  });

  it('runs health check once per session on session events', async () => {
    const project = uninitializedProject();
    const { client, showToast } = mockClient();
    const hooks = await Plugin({ directory: makeTempDir(), worktree: project, client });

    const event = { type: 'session.updated', properties: { info: { id: 's1' } } };
    await hooks.event({ event });
    await hooks.event({ event }); // same session → no re-check

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast.mock.calls[0][0].body.message).toContain('项目未初始化');
  });

  it('ignores non-session events', async () => {
    const { client, showToast } = mockClient();
    const hooks = await Plugin({ directory: makeTempDir(), worktree: uninitializedProject(), client });
    await hooks.event({ event: { type: 'message.updated', properties: {} } });
    expect(showToast).not.toHaveBeenCalled();
  });

  it('stays silent for a healthy project', async () => {
    const project = uninitializedProject();
    mkdirSync(join(project, '.loom', 'memory'), { recursive: true });
    writeFileSync(join(project, '.loom', 'memory', 'constitution.md'), '# c');
    writeFileSync(join(project, '.loom', 'workflow.yaml'), 'version: 1');

    const { client, showToast } = mockClient();
    const hooks = await Plugin({ directory: makeTempDir(), worktree: project, client });
    await hooks.event({ event: { type: 'session.updated', properties: { info: { id: 's1' } } } });
    expect(showToast).not.toHaveBeenCalled();
  });

  it('falls back to console when toast unavailable', async () => {
    const project = uninitializedProject();
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const hooks = await Plugin({ directory: makeTempDir(), worktree: project, client: {} });
    await hooks.event({ event: { type: 'session.idle', properties: { sessionID: 's9' } } });
    expect(spy.mock.calls.some(c => String(c[0]).includes('项目未初始化'))).toBe(true);
    spy.mockRestore();
  });
});
