import { existsSync, readFileSync, mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = join(__dirname, '..', '..', 'skills');

export function convertSkillToMdc(skillName, skillDir, { compact = false } = {}) {
  const skillMdPath = join(skillDir, 'SKILL.md');
  if (!existsSync(skillMdPath)) return null;

  const content = readFileSync(skillMdPath, 'utf-8');
  const { frontmatter, body } = parseFrontmatter(content);

  const name = frontmatter.name || skillName;
  const description = frontmatter.description || `${name} skill`;

  const mdcFrontmatter = buildMdcFrontmatter({ name, description });

  if (compact) {
    const compactBody = buildCompactBody(name, frontmatter, body);
    return `---\n${mdcFrontmatter}\n---\n\n${compactBody}`;
  }

  const adaptedBody = adaptBodyReferences(body);
  return `---\n${mdcFrontmatter}\n---\n\n${adaptedBody}`;
}

/**
 * 构建紧凑 L0 摘要 body：
 * - summary 一句话
 * - 触发条件
 * - section 标题列表
 * - 提示用 MCP 获取详细内容
 */
function buildCompactBody(name, frontmatter, body) {
  const lines = [];

  if (frontmatter.description) {
    lines.push(`**Description**: ${frontmatter.description}`);
    lines.push('');
  }

  const triggers = extractTriggers(body);
  if (triggers.length > 0) {
    lines.push('**When to use**:');
    for (const t of triggers) {
      lines.push(`- ${t}`);
    }
    lines.push('');
  }

  const sections = extractSectionTitles(body);
  if (sections.length > 0) {
    lines.push(`**Sections**: ${sections.join(', ')}`);
    lines.push('');
  }

  const shortName = name.replace(/^loom-/, '');
  lines.push(`> For detailed instructions, use MCP tool: \`loom_get_skill_context(skill="${shortName}")\``);

  return lines.join('\n');
}

function extractTriggers(text) {
  const lines = text.split('\n');
  const result = [];
  let inTrigger = false;
  let inFence = false;
  let fenceChar = '';
  let lineCount = 0;

  for (const line of lines) {
    const fence = line.match(/^\s*(```+|~~~+)/);
    if (fence) {
      const ch = fence[1][0];
      if (!inFence) { inFence = true; fenceChar = ch; }
      else if (ch === fenceChar) { inFence = false; fenceChar = ''; }
      continue;
    }
    if (inFence) continue;

    const h2 = line.match(/^##\s+/);
    if (h2) {
      if (inTrigger) break;
      const title = line.replace(/^##\s+/, '').trim().toLowerCase();
      if (title.includes('触发') || title.includes('trigger')) {
        inTrigger = true;
      }
      continue;
    }
    if (inTrigger && line.trim()) {
      result.push(line.trim().replace(/^[-*]\s*/, ''));
      lineCount++;
      if (lineCount >= 5) break;
    }
  }
  return result;
}

function extractSectionTitles(text) {
  const lines = text.split('\n');
  const titles = [];
  let inFence = false;
  let fenceChar = '';

  for (const line of lines) {
    const fence = line.match(/^\s*(```+|~~~+)/);
    if (fence) {
      const ch = fence[1][0];
      if (!inFence) { inFence = true; fenceChar = ch; }
      else if (ch === fenceChar) { inFence = false; fenceChar = ''; }
      continue;
    }
    if (!inFence) {
      const h2 = line.match(/^##\s+(.+?)\s*$/);
      if (h2) titles.push(h2[1].trim());
    }
  }
  return titles;
}

export function convertCommandToMdc(cmdFilePath) {
  if (!existsSync(cmdFilePath)) return null;

  const content = readFileSync(cmdFilePath, 'utf-8');
  const name = basename(cmdFilePath, '.md');

  const description = extractCommandDescription(content, name);

  const mdcFrontmatter = buildMdcFrontmatter({ name: `cmd-${name}`, description, alwaysApply: false });

  return `---\n${mdcFrontmatter}\n---\n\n${content}`;
}

export function convertAllSkills(skillsSrc, destDir, log) {
  if (!existsSync(skillsSrc)) return 0;

  mkdirSync(destDir, { recursive: true });

  // 环境变量控制是否使用紧凑 L0 模式（默认紧凑）
  const compact = process.env.LOOM_CURSOR_FULL_SKILL !== '1';

  const convertedNames = new Set();
  let count = 0;
  for (const entry of readdirSync(skillsSrc, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillMd = join(skillsSrc, entry.name, 'SKILL.md');
    if (!existsSync(skillMd)) continue;

    const mdcContent = convertSkillToMdc(entry.name, join(skillsSrc, entry.name), { compact });
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
    let pendingKey = null;
    for (const line of lines) {
      const kv = line.match(/^(\w[\w-]*):\s*(.*?)\s*$/);
      if (kv) {
        const [, key, rawValue] = kv;
        if (rawValue.startsWith('>') || rawValue.startsWith('|')) {
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
    body = match[2];
  }

  return { frontmatter, body };
}

function buildMdcFrontmatter({ name, description, alwaysApply = false }) {
  const lines = [`description: ${quoteYamlString(description)}`];
  if (alwaysApply === false) {
    lines.push('alwaysApply: false');
  } else {
    lines.push('alwaysApply: true');
  }
  return lines.join('\n');
}

function quoteYamlString(value) {
  const normalized = String(value).replace(/\s+/g, ' ').trim();
  return JSON.stringify(normalized);
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
