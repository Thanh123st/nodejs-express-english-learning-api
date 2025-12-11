const fs = require("fs");
const path = require("path");

// Heuristics:
// - Preserve NULL as is
// - Unquote booleans: 'true'/'false' -> true/false when the entire token matches (case-insensitive)
// - Unquote numeric-looking values: /^-?\d+(\.\d+)?$/
// - Normalize JS date-like strings to ISO; keep quoted
// - Otherwise keep as originally quoted

function isQuoted(value) {
  return value.length >= 2 && value.startsWith("'") && value.endsWith("'");
}

function stripQuotes(value) {
  return value.slice(1, -1);
}

function looksLikeNumber(str) {
  return /^-?\d+(?:\.\d+)?$/.test(str);
}

function looksLikeBoolean(str) {
  const v = str.toLowerCase();
  return v === "true" || v === "false";
}

function isHumanReadableDate(str) {
  // Must contain weekday or GMT or month name to avoid parsing bare numbers like '1' or '1687'
  return /(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s|GMT|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/.test(str);
}

function toPostgresValue(raw) {
  const trimmed = raw.trim();
  if (trimmed.toUpperCase() === "NULL") return "NULL";

  if (isQuoted(trimmed)) {
    const inner = stripQuotes(trimmed);

    // NULL in quotes -> treat as literal string, keep quoted with escaped quotes
    if (inner.toUpperCase() === "NULL") {
      return "'NULL'";
    }

    // Quoted boolean -> unquote to boolean literal
    if (looksLikeBoolean(inner)) {
      return inner.toLowerCase();
    }

    // Human readable JS date string -> convert to ISO and keep quoted
    if (isHumanReadableDate(inner)) {
      const d = new Date(inner);
      if (!Number.isNaN(d.getTime())) {
        return `'${d.toISOString()}'`;
      }
    }

    // UUIDs, text, etc.: keep quoted, but escape single quotes
    return `'${inner.replace(/'/g, "''")}'`;
  }

  // Unquoted token: keep booleans normalized; keep numbers as-is
  if (looksLikeBoolean(trimmed)) return trimmed.toLowerCase();
  // For unquoted numbers, keep as-is (already unquoted)
  // Fallback: return as-is
  return trimmed;
}

function transformInsertLine(line) {
  // Only process INSERT INTO ... VALUES (...);
  const match = line.match(/^(\s*INSERT\s+INTO\s+[^()]+VALUES\s*)\((.*)\)(\s*;\s*)$/i);
  if (!match) return line;

  const prefix = match[1];
  const valuesPart = match[2];
  const suffix = match[3] || ";";

  // Split values by commas while respecting single quotes
  const tokens = [];
  let current = "";
  let inQuote = false;
  for (let i = 0; i < valuesPart.length; i++) {
    const ch = valuesPart[i];
    if (ch === "'") {
      // handle escaped single quote ''
      if (inQuote && valuesPart[i + 1] === "'") {
        current += "''";
        i += 1;
        continue;
      }
      inQuote = !inQuote;
      current += ch;
      continue;
    }
    if (!inQuote && ch === ",") {
      tokens.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.length) tokens.push(current.trim());

  const transformed = tokens.map(toPostgresValue);
  return `${prefix}(${transformed.join(", ")})${suffix}`;
}

function main() {
  const inputPath = process.argv[2] || path.resolve(process.cwd(), "users_inserts.sql");
  const outputPath = process.argv[3] || path.resolve(process.cwd(), "users_inserts_postgres.sql");

  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(inputPath, "utf8");
  const lines = content.split(/\r?\n/);
  const outLines = lines.map((line) => transformInsertLine(line));
  fs.writeFileSync(outputPath, outLines.join("\n"), "utf8");
  console.log(`✅ Converted ${lines.length} lines -> ${outputPath}`);
}

if (require.main === module) {
  main();
}


