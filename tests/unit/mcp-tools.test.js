import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { executeToolCall, TOOL_DEFINITIONS } from '../../src/mcp/tools.js';
import { SessionStore } from '../../src/mcp/session-store.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'loom-mcp-')); }

describe('MCP tool definitions', () => {
  it('exposes the documented 8 tools', () => {
    expect(TOOL_DEFINITIONS).toHaveLength(8);
    expect(TOOL_DEFINITIONS.map(t => t.name)).toContain('loom_attach_spec');
  });
});

describe('path sandboxing', () => {
  it('rejects spec_dir escaping project root', () => {
    const root = tmp();
    const store = new SessionStore();
    expect(() =>
      executeToolCall('loom_get_pipeline_context', { spec_dir: '../../etc', project_root: root }, store, 's1')
    ).toThrow(/escapes project root/);
  });

  it('rejects escape via update_task_state too', () => {
    const root = tmp();
    const store = new SessionStore();
    expect(() =>
      executeToolCall('loom_update_task_state',
        { spec_dir: '../../../tmp/evil', task_id: 'T1', status: 'done', project_root: root },
        store, 's1')
    ).toThrow(/escapes project root/);
  });
});

describe('happy path', () => {
  it('attach + project status', () => {
    const root = tmp();
    mkdirSync(join(root, 'specs'), { recursive: true });
    const store = new SessionStore();
    const att = executeToolCall('loom_attach_spec',
      { spec_dir: join(root, 'specs', 'x'), project_root: root }, store, 's1');
    expect(att.ok).toBe(true);
    const status = executeToolCall('loom_get_project_status', {}, store, 's1');
    expect(status.project_root).toBe(root);
    expect(Array.isArray(status.pipelines)).toBe(true);
  });

  it('update_task_state writes within sandbox', () => {
    const root = tmp();
    const specDir = join(root, 'specs', 'x');
    mkdirSync(specDir, { recursive: true });
    const store = new SessionStore();
    const r = executeToolCall('loom_update_task_state',
      { spec_dir: 'specs/x', task_id: 'T1', status: 'executing', project_root: root },
      store, 's1');
    expect(r.ok).toBe(true);
    expect(r.task.status).toBe('executing');
  });
});
