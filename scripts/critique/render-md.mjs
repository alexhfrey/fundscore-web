#!/usr/bin/env node
/**
 * render-md.mjs — render any markdown file into a single self-contained dark-theme
 * HTML page (no external assets). Reusable for specs, design docs, etc.
 *
 * Usage: node scripts/critique/render-md.mjs --in <file.md> --out <file.html> [--title "..."]
 */
import { readFileSync, writeFileSync } from "node:fs";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const inPath = arg("in"), outPath = arg("out");
if (!inPath || !outPath) { console.error("usage: --in <md> --out <html> [--title ...]"); process.exit(1); }
const src = readFileSync(inPath, "utf8");
const title = arg("title", (src.match(/^#\s+(.+)$/m)?.[1]) || "Document");
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (s) =>
  esc(s).replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

const lines = src.split("\n");
let html = "", i = 0, inCode = false, listType = null;
const closeList = () => { if (listType) { html += `</${listType}>`; listType = null; } };

function renderTable(start) {
  // collect consecutive | rows
  const rows = [];
  let j = start;
  while (j < lines.length && /^\s*\|/.test(lines[j])) { rows.push(lines[j]); j++; }
  const cells = (r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  const isSep = (r) => /^\s*\|?[\s:|-]+\|?\s*$/.test(r) && r.includes("-");
  let out = '<table>';
  rows.forEach((r, idx) => {
    if (isSep(r)) return;
    const tag = idx === 0 ? "th" : "td";
    out += "<tr>" + cells(r).map((c) => `<${tag}>${inline(c)}</${tag}>`).join("") + "</tr>";
  });
  out += "</table>";
  return [out, j];
}

while (i < lines.length) {
  const line = lines[i];
  if (line.trim().startsWith("```")) { closeList(); inCode = !inCode; html += inCode ? "<pre>" : "</pre>"; i++; continue; }
  if (inCode) { html += esc(line) + "\n"; i++; continue; }
  if (/^\s*\|/.test(line)) { closeList(); const [t, next] = renderTable(i); html += t; i = next; continue; }
  if (/^#{1,6}\s/.test(line)) { closeList(); const lvl = Math.min(line.match(/^#+/)[0].length, 6); html += `<h${lvl}>${inline(line.replace(/^#+\s/, ""))}</h${lvl}>`; i++; continue; }
  if (/^>\s?/.test(line)) { closeList(); html += `<blockquote>${inline(line.replace(/^>\s?/, ""))}</blockquote>`; i++; continue; }
  if (/^\s*[-*]\s/.test(line)) { if (listType !== "ul") { closeList(); html += "<ul>"; listType = "ul"; } html += `<li>${inline(line.replace(/^\s*[-*]\s/, ""))}</li>`; i++; continue; }
  if (/^\s*\d+\.\s/.test(line)) { if (listType !== "ol") { closeList(); html += "<ol>"; listType = "ol"; } html += `<li>${inline(line.replace(/^\s*\d+\.\s/, ""))}</li>`; i++; continue; }
  closeList();
  if (line.trim() === "---") { html += "<hr>"; i++; continue; }
  if (line.trim() === "") { i++; continue; }
  html += `<p>${inline(line)}</p>`; i++;
}
closeList();
if (inCode) html += "</pre>";

const out = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>
  :root{color-scheme:dark}*{box-sizing:border-box}
  body{margin:0;background:#0f172a;color:#e2e8f0;font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
  .wrap{max-width:820px;margin:0 auto;padding:40px 24px 90px}
  h1{font-size:27px;margin:0 0 6px;line-height:1.25}
  h2{font-size:21px;margin:34px 0 8px;padding-top:14px;border-top:1px solid #1e293b}
  h3{font-size:17px;margin:22px 0 6px;color:#f1f5f9}
  h4{font-size:15px;margin:16px 0 4px;color:#cbd5e1}
  p{margin:9px 0;color:#cbd5e1}
  a{color:#7dd3fc}
  code{background:#1e293b;padding:1.5px 6px;border-radius:5px;font-size:13.5px;color:#fbcfe8}
  pre{background:#1e293b;border:1px solid #334155;border-radius:8px;padding:14px 16px;overflow:auto;font-size:13px;line-height:1.5}
  pre code{background:none;padding:0;color:#cbd5e1}
  ul,ol{margin:8px 0;padding-left:24px}li{margin:4px 0;color:#cbd5e1}
  blockquote{margin:12px 0;padding:10px 16px;border-left:3px solid #38bdf8;background:#0c2733;border-radius:0 8px 8px 0;color:#e0f2fe;font-style:italic}
  hr{border:none;border-top:1px solid #1e293b;margin:24px 0}
  table{border-collapse:collapse;width:100%;margin:12px 0;font-size:13.5px}
  th,td{border:1px solid #334155;padding:7px 10px;text-align:left;vertical-align:top}
  th{background:#1e293b;color:#f1f5f9;font-weight:600}
  td{color:#cbd5e1}
  strong,b{color:#f8fafc}
</style></head><body><div class="wrap">${html}</div></body></html>`;
writeFileSync(outPath, out);
console.log(JSON.stringify({ ok: true, out: outPath }));
