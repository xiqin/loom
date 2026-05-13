import { describe, it, expect, vi } from 'vitest';

describe('list command', () => {
  it('lists skills when type is "skills"', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { default: list } = await import('../../src/commands/list.js');
    await list({ type: 'skills' });
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('brainstorming');
    expect(output).toContain('writing-plans');
    consoleSpy.mockRestore();
  });

  it('lists commands when type is "commands"', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { default: list } = await import('../../src/commands/list.js');
    await list({ type: 'commands' });
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('(no commands found)');
    consoleSpy.mockRestore();
  });

  it('lists all when type is "all"', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { default: list } = await import('../../src/commands/list.js');
    await list({ type: 'all' });
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Skills');
    expect(output).toContain('Commands');
    consoleSpy.mockRestore();
  });
});
