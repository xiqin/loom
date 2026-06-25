import { afterEach, describe, expect, it, vi } from 'vitest';

async function importTelemetry() {
  vi.resetModules();
  return import('../../src/mcp/telemetry.js');
}

afterEach(() => {
  delete process.env.LOOM_TELEMETRY;
  vi.resetModules();
});

describe('MCP telemetry', () => {
  it('stays empty when disabled', async () => {
    delete process.env.LOOM_TELEMETRY;
    const telemetry = await importTelemetry();

    telemetry.recordCall('loom_get_context', 10);
    const snapshot = telemetry.getSnapshot();

    expect(snapshot.enabled).toBe(false);
    expect(snapshot.tools).toEqual({});
  });

  it('returns a keyed snapshot when enabled', async () => {
    process.env.LOOM_TELEMETRY = '1';
    const telemetry = await importTelemetry();

    telemetry.recordCall('loom_get_context', 12.4, { responseBytes: 40 });
    telemetry.recordCall('loom_get_context', 7.6, { responseBytes: 20, responseTokens: 5 });
    const snapshot = telemetry.getSnapshot();

    expect(snapshot.enabled).toBe(true);
    expect(snapshot.tools.loom_get_context.calls).toBe(2);
    expect(snapshot.tools.loom_get_context.total_ms).toBe(20);
    expect(snapshot.tools.loom_get_context.total_response_bytes).toBe(60);
    expect(snapshot.tools.loom_get_context.last_response_bytes).toBe(20);
    expect(snapshot.tools.loom_get_context.estimated_response_tokens).toBe(15);
    expect(snapshot.tools.loom_get_context.last_response_tokens).toBe(5);
    expect(snapshot.tools.loom_get_context.last_call).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
