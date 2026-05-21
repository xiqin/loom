#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEFAULT_ROOT = join(__dirname, '..', '..', '..');

export function lintSkills(options = {}) {
  const root = options.root || DEFAULT_ROOT;
  const skillsDir = join(root, 'skills');
  const errors = [];
  const warnings = [];
  const skills = [];

  if (!existsSync(skillsDir)) {
    errors.push(`Missing skills directory: ${formatPath(root, skillsDir)}`);
    return { ok: false, errors, warnings, skills };
  }

  for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillDir = join(skillsDir, entry.name);
    const skillMd = join(skillDir, 'SKILL.md');
    if (!existsSync(skillMd)) continue;

    const content = readFileSync(skillMd, 'utf8');
    const parsed = parseSkill(content);
    skills.push(entry.name);

    if (!parsed.frontmatter.name) {
      errors.push(`${entry.name}: missing frontmatter name`);
    } else if (parsed.frontmatter.name !== entry.name) {
      errors.push(`${entry.name}: frontmatter name must match directory name`);
    }

    const description = parsed.frontmatter.description || '';
    if (!description.trim()) {
      errors.push(`${entry.name}: missing frontmatter description`);
    }
    if (!/Use when:/i.test(description)) {
      warnings.push(`${entry.name}: description should include "Use when:" for better trigger precision`);
    }
    if (description.replace(/\s+/g, ' ').trim().length > 600) {
      warnings.push(`${entry.name}: description is long; keep trigger metadata concise`);
    }

    checkReferenceConventions(skillDir, entry.name, content, errors);
    checkReferencedFiles(root, skillDir, entry.name, content, errors);
    checkEvals(skillDir, entry.name, errors);
  }

  return { ok: errors.length === 0, errors, warnings, skills };
}

function parseSkill(content) {
  const frontmatter = {};
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) return { frontmatter, body: content };

  let pendingKey = null;
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*?)\s*$/);
    if (kv) {
      const [, key, rawValue] = kv;
      if (rawValue === '>' || rawValue === '|') {
        pendingKey = key;
        frontmatter[key] = '';
      } else {
        pendingKey = null;
        frontmatter[key] = rawValue;
      }
      continue;
    }

    if (pendingKey && /^\s+/.test(line)) {
      frontmatter[pendingKey] = `${frontmatter[pendingKey]} ${line.trim()}`.trim();
    } else if (line.trim()) {
      pendingKey = null;
    }
  }

  return { frontmatter, body: match[2] };
}

function checkReferencedFiles(root, skillDir, skillName, content, errors) {
  const refs = new Set();
  const pattern = /`((?:references|scripts|assets)\/[^`\s]+)`/g;
  for (const match of content.matchAll(pattern)) {
    refs.add(match[1].replace(/[),.;:]+$/u, ''));
  }

  for (const ref of refs) {
    const fullPath = normalize(join(skillDir, ref));
    if (!fullPath.startsWith(normalize(skillDir))) {
      errors.push(`${skillName}: reference escapes skill directory: ${ref}`);
      continue;
    }
    if (!existsSync(fullPath)) {
      errors.push(`${skillName}: missing referenced file ${ref}`);
    }
  }
}

function checkReferenceConventions(skillDir, skillName, content, errors) {
  for (const entry of readdirSync(skillDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (/^references?$/i.test(entry.name) && entry.name !== 'references') {
      errors.push(`${skillName}: reference directory must be named references (found ${entry.name})`);
    }
  }

  const legacyPattern = /`((?:REFERENCE|REFERENCES|Reference|References|reference)\/[^`\s]+)`/g;
  for (const match of content.matchAll(legacyPattern)) {
    errors.push(`${skillName}: use references/ path casing for ${match[1]}`);
  }
}

function checkEvals(skillDir, skillName, errors) {
  const evalPath = join(skillDir, 'evals', 'triggers.json');
  if (!existsSync(evalPath)) return;

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(evalPath, 'utf8'));
  } catch (error) {
    errors.push(`${skillName}: invalid evals/triggers.json (${error.message})`);
    return;
  }

  if (parsed.version !== 1) {
    errors.push(`${skillName}: evals/triggers.json version must be 1`);
  }
  if (parsed.skill !== skillName) {
    errors.push(`${skillName}: evals skill must match directory name`);
  }
  for (const key of ['positive', 'negative']) {
    if (!Array.isArray(parsed[key]) || parsed[key].length < 3) {
      errors.push(`${skillName}: evals.${key} must contain at least 3 cases`);
      continue;
    }
    for (const [index, item] of parsed[key].entries()) {
      if (!item.prompt || !item.reason) {
        errors.push(`${skillName}: evals.${key}[${index}] must include prompt and reason`);
      }
    }
  }
}

function formatPath(root, path) {
  return relative(root, path) || '.';
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') options.root = argv[++i];
  }
  return options;
}

function printReport(result) {
  for (const warning of result.warnings) console.warn(`WARN ${warning}`);
  for (const error of result.errors) console.error(`ERROR ${error}`);
  console.log(`Checked ${result.skills.length} skills`);
}

if (process.argv[1] === __filename) {
  const result = lintSkills(parseArgs(process.argv.slice(2)));
  printReport(result);
  if (!result.ok) process.exitCode = 1;
}
