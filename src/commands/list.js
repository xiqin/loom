import { readdirSync, statSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = join(__dirname, '..', '..');

export default async function list(options) {
  const { type = 'all' } = options;

  if (type === 'skills' || type === 'all') {
    console.log('\n  Skills:');
    const skillsDir = join(ASSETS_DIR, 'skills');
    try {
      const entries = readdirSync(skillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillMd = join(skillsDir, entry.name, 'SKILL.md');
          try {
            if (statSync(skillMd).isFile()) {
              const desc = extractDescription(readFileSync(skillMd, 'utf-8'));
              console.log(`    ${entry.name} — ${desc}`);
            }
          } catch {}
        }
      }
    } catch {
      console.log('    (no skills found)');
    }
  }

  if (type === 'commands' || type === 'all') {
    console.log('\n  Commands:');
    const commandsDir = join(ASSETS_DIR, 'commands');
    try {
      const entries = readdirSync(commandsDir, { withFileTypes: true });
      const mdFiles = entries.filter(e => e.isFile() && e.name.endsWith('.md'));
      if (mdFiles.length === 0) {
        console.log('    (no commands found)');
      }
      for (const entry of mdFiles) {
        const name = entry.name.replace('.md', '');
        console.log(`    /${name}`);
      }
    } catch {
      console.log('    (no commands found)');
    }
  }

  console.log('');
}

function extractDescription(content) {
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.startsWith('description:')) {
      return line.replace('description:', '').trim().replace(/^>\s*/, '').slice(0, 80);
    }
  }
  for (const line of lines) {
    if (line.startsWith('# ')) {
      return line.replace('# ', '').trim();
    }
  }
  return '(no description)';
}
