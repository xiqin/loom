import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CodexAdapter } from '../../src/adapters/codex.js';

const TEST_DIR = join(import.meta.dirname, '__test_codex__');
const ORIGINAL_CODEX_HOME = process.env.CODEX_HOME;

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  delete process.env.CODEX_HOME;
});

afterEach(() => {
  vi.restoreAllMocks();
  if (ORIGINAL_CODEX_HOME === undefined) {
    delete process.env.CODEX_HOME;
  } else {
    process.env.CODEX_HOME = ORIGINAL_CODEX_HOME;
  }
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('CodexAdapter', () => {
  const adapter = new CodexAdapter();

  it('has toolName "codex"', () => {
    expect(adapter.toolName).toBe('codex');
  });

  it('getUserDir defaults to ~/.codex', () => {
    expect(adapter.getUserDir()).toContain('.codex');
  });

  it('getUserDir respects CODEX_HOME', () => {
    process.env.CODEX_HOME = join(TEST_DIR, 'custom-codex-home');
    expect(adapter.getUserDir()).toBe(process.env.CODEX_HOME);
  });

  it('installs skills and templates without removing non-loom skills', () => {
    vi.spyOn(adapter, 'getUserDir').mockReturnValue(join(TEST_DIR, '.codex'));

    const loomRoot = join(TEST_DIR, 'loom-root');
    mkdirSync(join(loomRoot, 'skills', 'loom-init-project'), { recursive: true });
    writeFileSync(join(loomRoot, 'skills', 'loom-init-project', 'SKILL.md'), '# Init');
    mkdirSync(join(loomRoot, 'templates'), { recursive: true });
    writeFileSync(join(loomRoot, 'templates', 'constitution.md'), '# Template');

    const skillsDir = join(TEST_DIR, '.codex', 'skills');
    mkdirSync(join(skillsDir, 'custom-skill'), { recursive: true });
    writeFileSync(join(skillsDir, 'custom-skill', 'SKILL.md'), '# Custom');
    mkdirSync(join(skillsDir, 'loom-old-skill'), { recursive: true });
    writeFileSync(join(skillsDir, 'loom-old-skill', 'SKILL.md'), '# Old');

    const log = adapter.install(loomRoot, '1.0.0');

    expect(existsSync(join(skillsDir, 'custom-skill', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(skillsDir, 'loom-old-skill'))).toBe(false);
    expect(existsSync(join(skillsDir, 'loom-init-project', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(skillsDir, 'loom-init-project', 'templates', 'constitution.md'))).toBe(true);
    expect(log.some(l => l.includes('templates'))).toBe(true);
  });

  it('uninstall removes only loom skills', () => {
    vi.spyOn(adapter, 'getUserDir').mockReturnValue(join(TEST_DIR, '.codex'));

    const skillsDir = join(TEST_DIR, '.codex', 'skills');
    mkdirSync(join(skillsDir, 'loom-test'), { recursive: true });
    writeFileSync(join(skillsDir, 'loom-test', 'SKILL.md'), '# Test');
    mkdirSync(join(skillsDir, 'custom-skill'), { recursive: true });
    writeFileSync(join(skillsDir, 'custom-skill', 'SKILL.md'), '# Custom');

    adapter.uninstall(TEST_DIR);

    expect(existsSync(join(skillsDir, 'loom-test'))).toBe(false);
    expect(existsSync(join(skillsDir, 'custom-skill', 'SKILL.md'))).toBe(true);
  });
});
