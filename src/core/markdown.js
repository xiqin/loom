export function escapeMarkdown(value) {
  return String(value ?? '-')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>');
}
