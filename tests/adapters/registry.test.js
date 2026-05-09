import { describe, it, expect } from 'vitest';
import { getAdapter, getEntryFilename, listAdapters } from '../../src/adapters/registry.js';

describe('adapter registry', () => {
  it('getAdapter returns ClaudeCodeAdapter for "claude-code"', () => {
    const adapter = getAdapter('claude-code');
    expect(adapter.name).toBe('claude-code');
  });

  it('getAdapter returns CursorAdapter for "cursor"', () => {
    const adapter = getAdapter('cursor');
    expect(adapter.name).toBe('cursor');
  });

  it('getAdapter returns CopilotAdapter for "copilot"', () => {
    const adapter = getAdapter('copilot');
    expect(adapter.name).toBe('copilot');
  });

  it('getAdapter throws for unknown tool', () => {
    expect(() => getAdapter('unknown')).toThrow('Unknown tool');
  });

  it('listAdapters returns all supported tools', () => {
    const tools = listAdapters();
    expect(tools).toEqual(['claude-code', 'cursor', 'copilot', 'opencode']);
  });

  it('getEntryFilename returns correct entry file per tool', () => {
    expect(getEntryFilename('claude-code')).toBe('CLAUDE.md');
    expect(getEntryFilename('cursor')).toBe('.cursorrules');
    expect(getEntryFilename('copilot')).toBe('.github/copilot-instructions.md');
    expect(getEntryFilename('opencode')).toBe('AGENTS.md');
  });

  it('getEntryFilename throws for unknown tool', () => {
    expect(() => getEntryFilename('unknown')).toThrow('Unknown tool');
  });
});
