import { describe, it, expect } from 'vitest';
import { injectVersion, parseVersion, needsUpdate } from '../../src/utils/version.js';

describe('version', () => {
  it('injectVersion adds version comment to markdown content', () => {
    const content = '# Hello\nSome text';
    const result = injectVersion(content, '1.0.0', 'markdown');
    expect(result).toBe('<!-- loom:version=1.0.0 -->\n# Hello\nSome text');
  });

  it('injectVersion adds version comment to plain text', () => {
    const content = 'some config line';
    const result = injectVersion(content, '1.0.0', 'text');
    expect(result).toBe('# loom:version=1.0.0\nsome config line');
  });

  it('parseVersion extracts version from markdown', () => {
    const content = '<!-- loom:version=1.2.3 -->\n# Hello';
    expect(parseVersion(content)).toBe('1.2.3');
  });

  it('parseVersion extracts version from text', () => {
    const content = '# loom:version=0.9.0\nsome text';
    expect(parseVersion(content)).toBe('0.9.0');
  });

  it('parseVersion returns null if no version found', () => {
    expect(parseVersion('no version here')).toBeNull();
  });

  it('needsUpdate returns true when versions differ', () => {
    expect(needsUpdate('1.0.0', '1.1.0')).toBe(true);
  });

  it('needsUpdate returns false when versions match', () => {
    expect(needsUpdate('1.0.0', '1.0.0')).toBe(false);
  });
});
