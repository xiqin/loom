import { existsSync, readFileSync, mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join, basename } from 'node:path';

export function convertSkillToMdc(skillName, skillDir) {
  const skillMdPath = join(skillDir, 'SKILL.md');
  if (!existsSync(skillMdPath)) return null;

  const content = readFileSync(skillMdPath, 'utf-8');
  const { frontmatter, body } = parseFrontmatter(content);

  const name = frontmatter.name || skillName;
  const description = frontmatter.description || `${name} skill`;

  const mdcFrontmatter = buildMdcFrontmatter({ name, description });

  const adaptedBody = adaptBodyReferences(body);

  return `---\n${mdcFrontmatter}---\n\n${adaptedBody}`;
}

export function convertCommandToMdc(cmdFilePath) {
  if (!existsSync(cmdFilePath)) return null;

  const content = readFileSync(cmdFilePath, 'utf-8');
  const name = basename(cmdFilePath, '.md');

  const description = extractCommandDescription(content, name);

  const mdcFrontmatter = buildMdcFrontmatter({ name: `cmd-${name}`, description, alwaysApply: false });

  return `---\n${mdcFrontmatter}---\n\n${content}`;
}

export function convertAllSkills(skillsSrc, destDir, log) {
  if (!existsSync(skillsSrc)) return 0;

  mkdirSync(destDir, { recursive: true });

  const convertedNames = new Set();
  let count = 0;
  for (const entry of readdirSync(skillsSrc, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillMd = join(skillsSrc, entry.name, 'SKILL.md');
    if (!existsSync(skillMd)) continue;

    const mdcContent = convertSkillToMdc(entry.name, join(skillsSrc, entry.name));
    if (!mdcContent) continue;

    const outPath = join(destDir, `loom-${entry.name}.mdc`);
    writeFileSync(outPath, mdcContent, 'utf-8');
    convertedNames.add(`loom-${entry.name}.mdc`);
    count++;
  }

  if (existsSync(destDir)) {
    for (const entry of readdirSync(destDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.startsWith('loom-')) continue;
      if (convertedNames.has(entry.name)) continue;
      rmSync(join(destDir, entry.name), { force: true });
      log.push(`  mdc rules: removed stale ${entry.name}`);
    }
  }

  return count;
}

export function convertAllCommands(cmdsSrc, destDir, log) {
  if (!existsSync(cmdsSrc)) return 0;

  mkdirSync(destDir, { recursive: true });

  const convertedNames = new Set();
  let count = 0;
  for (const entry of readdirSync(cmdsSrc, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    if (entry.name.endsWith('.spec.json')) continue;

    const mdcContent = convertCommandToMdc(join(cmdsSrc, entry.name));
    if (!mdcContent) continue;

    const outPath = join(destDir, `loom-cmd-${basename(entry.name, '.md')}.mdc`);
    writeFileSync(outPath, mdcContent, 'utf-8');
    convertedNames.add(basename(outPath));
    count++;
  }

  if (existsSync(destDir)) {
    for (const entry of readdirSync(destDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.startsWith('loom-cmd-')) continue;
      if (convertedNames.has(entry.name)) continue;
      rmSync(join(destDir, entry.name), { force: true });
      log.push(`  mdc rules: removed stale ${entry.name}`);
    }
  }

  return count;
}

function parseFrontmatter(content) {
  const frontmatter = {};
  let body = content;

  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (match) {
    const lines = match[1].split('\n');
    for (const line of lines) {
      const kv = line.match(/^(\w[\w-]*):\s*(.*?)\s*$/);
      if (kv) {
        frontmatter[kv[1]] = kv[2];
      }
    }
    body = match[2];
  }

  return { frontmatter, body };
}

function buildMdcFrontmatter({ name, description, alwaysApply = false }) {
  const lines = [`description: ${description}`];
  if (alwaysApply === false) {
    lines.push('alwaysApply: false');
  } else {
    lines.push('alwaysApply: true');
  }
  return lines.join('\n');
}

function extractCommandDescription(content, name) {
  const firstLine = content.split('\n')[0];
  if (firstLine && firstLine.startsWith('# ')) {
    return firstLine.slice(2).trim();
  }
  return `Command: ${name}`;
}

function adaptBodyReferences(body) {
  let adapted = body;

  adapted = adapted.replace(
    /`([a-z]+(?:-[a-z]+)+)\/(?:SKILL|script|REFERENCE)\b[^`]*`/g,
    (match, skillName) => `\`${skillName}\` skill`
  );

  return adapted;
}
