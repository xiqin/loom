import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { BaseAdapter } from '../../src/adapters/base.js';

describe('BaseAdapter', () => {
  it('throws on unimplemented toolName', () => {
    const adapter = new BaseAdapter();
    expect(() => adapter.toolName).toThrow('must implement toolName');
  });

  it('throws on unimplemented getUserDir()', () => {
    const adapter = new BaseAdapter();
    expect(() => adapter.getUserDir()).toThrow('must implement getUserDir');
  });

  it('getSkillsDir returns getUserDir()/skills', () => {
    class TestAdapter extends BaseAdapter {
      get toolName() { return 'test'; }
      getUserDir() { return '/tmp/test-user'; }
    }
    const adapter = new TestAdapter();
    expect(adapter.getSkillsDir()).toBe(join('/tmp/test-user', 'skills'));
  });

  it('getCommandsDir returns null by default', () => {
    class TestAdapter extends BaseAdapter {
      get toolName() { return 'test'; }
      getUserDir() { return '/tmp/test-user'; }
    }
    const adapter = new TestAdapter();
    expect(adapter.getCommandsDir()).toBeNull();
  });

  it('supportsPlugin returns false by default', () => {
    class TestAdapter extends BaseAdapter {
      get toolName() { return 'test'; }
      getUserDir() { return '/tmp/test-user'; }
    }
    const adapter = new TestAdapter();
    expect(adapter.supportsPlugin()).toBe(false);
  });
});
