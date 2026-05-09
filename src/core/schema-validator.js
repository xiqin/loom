import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load schema ──────────────────────────────────────────────────────

let _schema = null;

function loadSchema() {
  if (_schema) return _schema;
  const raw = readFileSync(join(__dirname, '..', '..', 'config', 'templates.schema.json'), 'utf-8');
  _schema = JSON.parse(raw);
  return _schema;
}

// ── Variable extraction ──────────────────────────────────────────────

const VAR_PATTERN = /\{\{([A-Z_][A-Z0-9_]*)\}\}/g;

/**
 * Extract all {{VAR}} names from template content.
 * Returns Set<string> of variable names.
 */
export function extractVariables(content) {
  const vars = new Set();
  let match;
  while ((match = VAR_PATTERN.exec(content)) !== null) {
    vars.add(match[1]);
  }
  return vars;
}

// ── Validation ───────────────────────────────────────────────────────

/**
 * Validate a rendered template against its schema definition.
 *
 * @param {string} templateId - Template id from schema
 * @param {string} content - Rendered content to validate
 * @returns {{ valid: boolean, missingRequired: string[], unexpectedVars: string[], missingOptional: string[] }}
 */
export function validateTemplate(templateId, content) {
  const schema = loadSchema();
  const def = schema.templates.find(t => t.id === templateId);
  if (!def) {
    return { valid: false, missingRequired: [], unexpectedVars: [], missingOptional: [], error: `Unknown template: ${templateId}` };
  }

  const foundVars = extractVariables(content);
  const requiredSet = new Set(def.requiredVariables);
  const optionalSet = new Set(def.optionalVariables || []);
  const allKnown = new Set([...requiredSet, ...optionalSet]);

  const missingRequired = [...requiredSet].filter(v => foundVars.has(v));
  const missingOptional = [...optionalSet].filter(v => foundVars.has(v));
  const unexpectedVars = [...foundVars].filter(v => !allKnown.has(v));

  return {
    valid: missingRequired.length === 0,
    missingRequired,
    missingOptional,
    unexpectedVars,
  };
}

/**
 * Validate raw template content (before rendering).
 * Checks that all variables in the template are declared in the schema.
 *
 * @param {string} templateId - Template id from schema
 * @param {string} rawContent - Raw template content with {{VAR}} placeholders
 * @returns {{ valid: boolean, undeclared: string[], undeclaredInRequired: string[] }}
 */
export function validateRawTemplate(templateId, rawContent) {
  const schema = loadSchema();
  const def = schema.templates.find(t => t.id === templateId);
  if (!def) {
    return { valid: false, undeclared: [], error: `Unknown template: ${templateId}` };
  }

  const foundVars = extractVariables(rawContent);
  const declaredSet = new Set([...(def.requiredVariables || []), ...(def.optionalVariables || [])]);

  const undeclared = [...foundVars].filter(v => !declaredSet.has(v));

  return {
    valid: undeclared.length === 0,
    undeclared,
  };
}

// ── Rendering ────────────────────────────────────────────────────────

const TODO_MARKER = (varName, hint) => `<!-- TODO: ${varName}: ${hint || '待填充'} -->`;

/**
 * Render a template by replacing {{VAR}} with values.
 *
 * Rules:
 * - Variables in `values` are replaced with their value
 * - Missing required variables become TODO markers
 * - Missing optional variables are silently removed (empty string)
 * - Returns { content, warnings }
 *
 * @param {string} templateId - Template id from schema
 * @param {string} rawContent - Raw template content
 * @param {Object<string, string>} values - Variable values { VAR_NAME: "value" }
 * @param {object} [options]
 * @param {string} [options.missingHint] - Hint text for TODO markers
 * @returns {{ content: string, warnings: string[], missingRequired: string[], missingOptional: string[] }}
 */
export function renderTemplate(templateId, rawContent, values = {}, options = {}) {
  const schema = loadSchema();
  const def = schema.templates.find(t => t.id === templateId);
  if (!def) {
    return { content: rawContent, warnings: [`Unknown template: ${templateId}`], missingRequired: [], missingOptional: [] };
  }

  const requiredSet = new Set(def.requiredVariables || []);
  const optionalSet = new Set(def.optionalVariables || []);
  const warnings = [];
  const missingRequired = [];
  const missingOptional = [];

  // Replace all {{VAR}} in content
  const content = rawContent.replace(VAR_PATTERN, (full, varName) => {
    if (varName in values && values[varName] !== undefined && values[varName] !== null) {
      return values[varName];
    }

    // Variable not provided
    if (requiredSet.has(varName)) {
      missingRequired.push(varName);
      return TODO_MARKER(varName, options.missingHint);
    }

    if (optionalSet.has(varName)) {
      missingOptional.push(varName);
      return '';
    }

    // Variable in template but not in schema — keep as-is with warning
    warnings.push(`Undeclared variable {{${varName}}} in template "${templateId}"`);
    return full;
  });

  // Build warnings for missing required
  if (missingRequired.length > 0) {
    warnings.push(`Template "${templateId}" has ${missingRequired.length} missing required variable(s): ${missingRequired.join(', ')}`);
  }

  return { content, warnings, missingRequired, missingOptional };
}

// ── Schema access ────────────────────────────────────────────────────

/**
 * Get template definition by id.
 */
export function getTemplateDef(templateId) {
  const schema = loadSchema();
  return schema.templates.find(t => t.id === templateId) || null;
}

/**
 * List all template ids.
 */
export function listTemplateIds() {
  const schema = loadSchema();
  return schema.templates.map(t => t.id);
}

/**
 * Get all unique variables across all templates.
 * Returns { required: string[], optional: string[] }
 */
export function getAllVariables() {
  const schema = loadSchema();
  const required = new Set();
  const optional = new Set();
  for (const t of schema.templates) {
    for (const v of t.requiredVariables || []) required.add(v);
    for (const v of t.optionalVariables || []) optional.add(v);
  }
  return { required: [...required].sort(), optional: [...optional].sort() };
}
