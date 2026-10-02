// data/src/convert/csv.js
// Small, dependency-free CSV parser (RFC 4180 style) used by the MEDA / MCS converters
// and by the live PDS reader in nasaData.js.
//
//   parseCsv(text) -> { headers: string[], rows: object[] }
//
// - Handles quoted cells, escaped quotes (""), embedded newlines, CRLF and a UTF-8 BOM.
// - Header names are trimmed. Empty lines are skipped.
// - A cell that is entirely a plain number becomes a JS number; everything else stays a
//   string (so LMST strings such as "Sol-1740M14:31:18" and ISO timestamps are preserved).
// - An empty cell becomes null.

const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

function cell(raw) {
  const s = raw.trim();
  if (s === "") return null;
  return NUMBER.test(s) ? Number(s) : s;
}

export function parseCsv(text) {
  if (typeof text !== "string") throw new TypeError("parseCsv(): text must be a string");
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const table = [];
  let row = [];
  let field = "";
  let quoted = false;
  let sawAny = false;

  const endField = () => { row.push(field); field = ""; };
  const endRow = () => {
    endField();
    if (row.length > 1 || row[0].trim() !== "") table.push(row);
    row = [];
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field === "") { quoted = true; sawAny = true; }
    else if (ch === ",") { endField(); sawAny = true; }
    else if (ch === "\n") { endRow(); sawAny = false; }
    else if (ch === "\r") { if (src[i + 1] === "\n") i++; endRow(); sawAny = false; }
    else { field += ch; sawAny = true; }
  }
  if (sawAny || field !== "" || row.length) endRow();

  if (!table.length) return { headers: [], rows: [] };
  const headers = table[0].map((h) => h.trim());
  const rows = table.slice(1).map((r) => {
    const o = {};
    headers.forEach((h, i) => { o[h] = i < r.length ? cell(r[i]) : null; });
    return o;
  });
  return { headers, rows };
}
