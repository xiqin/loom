const MARKDOWN_RE = /<!-- loom:version=([\d.]+) -->/;
const TEXT_RE = /^# loom:version=([\d.]+)/m;

export function injectVersion(content, version, format = 'markdown') {
  const tag = format === 'markdown'
    ? `<!-- loom:version=${version} -->`
    : `# loom:version=${version}`;
  return `${tag}\n${content}`;
}

export function parseVersion(content) {
  const mdMatch = content.match(MARKDOWN_RE);
  if (mdMatch) return mdMatch[1];
  const textMatch = content.match(TEXT_RE);
  if (textMatch) return textMatch[1];
  return null;
}

function parseSemver(v) {
  const parts = v.split('.').map(Number);
  return { major: parts[0] || 0, minor: parts[1] || 0, patch: parts[2] || 0 };
}

function compareSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  return pa.patch - pb.patch;
}

export function needsUpdate(installedVersion, currentVersion) {
  if (!installedVersion) return true;
  return compareSemver(installedVersion, currentVersion) < 0;
}
