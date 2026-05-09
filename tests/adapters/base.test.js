import { describe, it, expect } from 'vitest';
import { BaseAdapter } from '../../src/adapters/base.js';

describe('BaseAdapter', () => {
  it('throws on unimplemented generate()', async () => {
    const adapter = new BaseAdapter();
    await expect(adapter.generate('/tmp', '1.0.0')).rejects.toThrow('must implement generate()');
  });

  it('throws on unimplemented getTargetFiles()', () => {
    const adapter = new BaseAdapter();
    expect(() => adapter.getTargetFiles('/tmp')).toThrow('must implement getTargetFiles()');
  });

  it('provides getAssetsDir()', () => {
    const adapter = new BaseAdapter();
    const dir = adapter.getAssetsDir();
    expect(dir).toBeTruthy();
  });

  it('provides readAsset()', () => {
    const adapter = new BaseAdapter();
    // pipeline.md should exist in assets
    const content = adapter.readAsset('core/pipeline.md');
    expect(content).toContain('流水线');
  });
});
