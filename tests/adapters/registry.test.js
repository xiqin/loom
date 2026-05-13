import { describe, it, expect } from 'vitest';
import { getUserAdapter, USER_TOOL_IDS } from '../../src/core/installer.js';

describe('user adapter registry', () => {
  it('USER_TOOL_IDS includes all expected tools', () => {
    expect(USER_TOOL_IDS).toContain('claude-code');
    expect(USER_TOOL_IDS).toContain('cursor');
    expect(USER_TOOL_IDS).toContain('copilot');
    expect(USER_TOOL_IDS).toContain('opencode');
    expect(USER_TOOL_IDS).toContain('codex');
  });

  it('getUserAdapter returns adapter for "claude-code"', async () => {
    const adapter = await getUserAdapter('claude-code');
    expect(adapter.toolName).toBe('claude-code');
  });

  it('getUserAdapter returns adapter for "cursor"', async () => {
    const adapter = await getUserAdapter('cursor');
    expect(adapter.toolName).toBe('cursor');
  });

  it('getUserAdapter returns adapter for "copilot"', async () => {
    const adapter = await getUserAdapter('copilot');
    expect(adapter.toolName).toBe('copilot');
  });

  it('getUserAdapter returns adapter for "opencode"', async () => {
    const adapter = await getUserAdapter('opencode');
    expect(adapter.toolName).toBe('opencode');
  });

  it('getUserAdapter returns adapter for "codex"', async () => {
    const adapter = await getUserAdapter('codex');
    expect(adapter.toolName).toBe('codex');
  });

  it('getUserAdapter throws for unknown tool', async () => {
    await expect(() => getUserAdapter('unknown')).rejects.toThrow('Unknown tool');
  });

  it('each adapter has getUserDir returning a string', async () => {
    for (const tool of USER_TOOL_IDS) {
      const adapter = await getUserAdapter(tool);
      expect(typeof adapter.getUserDir()).toBe('string');
    }
  });

  it('each adapter has getSkillsDir returning a string (except cursor which uses rules)', async () => {
    for (const tool of USER_TOOL_IDS) {
      const adapter = await getUserAdapter(tool);
      const result = adapter.getSkillsDir();
      if (tool === 'cursor') {
        expect(result).toBeNull();
      } else {
        expect(typeof result).toBe('string');
      }
    }
  });
});
