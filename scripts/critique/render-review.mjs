#!/usr/bin/env node
/**
 * render-review.mjs — render a review-artifacts result into a single self-contained
 * decision-brief dashboard (dark theme, no external assets).
 *
 * Altitude: the owner sees, per artifact — a plain-English brief, the decisions that
 * genuinely need them, the artifact itself (inline, collapsible), and engineering
 * issues collapsed (resolved by the loop). NOT a finding dump.
 *
 * Usage: node scripts/critique/render-review.mjs --in <result.json> --out <report.html> [--title "..."]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const inPath = arg("in"), outPath = arg("out"), title = arg("title", "Review");
if (!inPath || !outPath) { console.error("usage: --in <json> --out <html> [--title ...]"); process.exit(1); }

const data = JSON.parse(readFileSync(inPath, "utf8"));
const reviews = data.reviews || [];
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Light, deterministic markdown -> HTML for the inline spec view.
function md(src) {
  const lines = esc(src).split("\n");
  let out = "", inList = false, inCode = false;
  const inline = (s) => s.replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  for (const raw of lines) {
    if (raw.trim().startsWith("```")) { if (inList) { out += "</ul>"; inList = false; } inCode = !inCode; out += inCode ? "<pre>" : "</pre>"; continue; }
    if (inCode) { out += raw + "\n"; continue; }
    let line = raw;
    if (/^#{1,6}\s/.test(line)) { if (inList) { out += "</ul>"; inList = false; } const lvl = Math.min(line.match(/^#+/)[0].length + 2, 6); out += `<h${lvl}>${inline(line.replace(/^#+\s/, ""))}</h${lvl}>`; continue; }
    if (/^\s*[-*]\s/.test(line)) { if (!inList) { out += "<ul>"; inList = true; } out += `<li>${inline(line.replace(/^\s*[-*]\s/, ""))}</li>`; continue; }
    if (inList) { out += "</ul>"; inList = false; }
    if (line.trim() === "---") { out += "<hr>"; continue; }
    if (line.trim() === "") continue;
    out += `<p>${inline(line)}</p>`;
  }
  if (inList) out += "</ul>";
  if (inCode) out += "</pre>";
  return out;
}

const ordered = [...reviews].sort((a, b) => (b.decisions?.length || 0) - (a.decisions?.length || 0));
const totals = {
  n: reviews.length,
  decisions: reviews.reduce((s, r) => s + (r.decisions?.length || 0), 0),
  fixed: reviews.reduce((s, r) => s + (r.engineering_resolved?.length || 0), 0),
  ready: reviews.filter((r) => !(r.decisions?.length)).length,
};

function card(r) {
  const dec = r.decisions || [], eng = r.engineering_resolved || [], engUn = r.engineering_unresolved || [];
  const specHtml = r.artifact && existsSync(r.artifact) ? md(readFileSync(r.artifact, "utf8")) : "<i>artifact not found on disk</i>";
  const b = r.brief || {};
  return `<div class="card">
    <div class="chead">
      <div class="ctitle">${esc(r.name)}</div>
      <span class="status ${dec.length ? "decide" : "ready"}">${dec.length ? `needs your call · ${dec.length}` : "ready"}</span>
    </div>
    <div class="brief">
      <div><span class="lbl">builds</span> ${esc(b.what)}</div>
      <div><span class="lbl">why</span> ${esc(b.why)}</div>
      <div><span class="lbl">for the user</span> ${esc(b.user_impact)}</div>
    </div>
    ${
      dec.length
        ? `<div class="decisions"><div class="bh">⚑ Needs your call</div>${dec
            .map((d) => `<div class="decision"><div class="q">${esc(d.issue)}</div><div class="rec"><span class="lbl">my rec</span> ${esc(d.proposed_fix)}</div></div>`)
            .join("")}</div>`
        : `<div class="readynote">No product decisions — ready to implement.</div>`
    }
    <details class="spec"><summary>View the spec</summary><div class="specbody">${specHtml}</div></details>
    <details class="eng"><summary>Engineering — ${eng.length} resolved by the loop${engUn.length ? ` · ${engUn.length} unresolved` : ""}</summary>
      ${eng.map((e) => `<div class="eitem"><b>${esc(e.issue)}</b> — ${esc(e.change)}</div>`).join("")}
      ${engUn.map((e) => `<div class="eitem un"><b>unresolved:</b> ${esc(e.issue)} — ${esc(e.reason)}</div>`).join("")}
      ${eng.length + engUn.length === 0 ? "<div class='eitem'>none</div>" : ""}
    </details>
  </div>`;
}

const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>
  :root{color-scheme:dark}*{box-sizing:border-box}
  body{margin:0;background:#0f172a;color:#e2e8f0;font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
  .wrap{max-width:860px;margin:0 auto;padding:32px 20px 80px}
  h1{font-size:24px;margin:0 0 4px}.sub{color:#94a3b8;font-size:13px;margin-bottom:18px}
  .totals{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px}
  .stat{background:#1e293b;border:1px solid #334155;border-radius:10px;padding:9px 15px}
  .stat b{font-size:20px;display:block}.stat span{color:#94a3b8;font-size:12px}
  .hint{color:#64748b;font-size:12px;margin:10px 0 22px}
  .card{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:18px 20px;margin-bottom:16px}
  .chead{display:flex;justify-content:space-between;align-items:center;gap:10px}
  .ctitle{font-size:16px;font-weight:600}
  .status{font-size:11px;padding:3px 10px;border-radius:999px;white-space:nowrap}
  .status.decide{background:#78350f33;color:#fbbf24;border:1px solid #78350f}
  .status.ready{background:#16653433;color:#4ade80;border:1px solid #166534}
  .brief{margin:12px 0;display:flex;flex-direction:column;gap:3px}
  .brief>div{color:#cbd5e1}
  .lbl{color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.03em;margin-right:6px}
  .decisions{background:#241c08;border:1px solid #5b4413;border-radius:9px;padding:12px 14px;margin-top:8px}
  .bh{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#fbbf24;margin-bottom:8px}
  .decision{padding:7px 0;border-top:1px solid #3f3413}.decision:first-of-type{border-top:none}
  .decision .q{font-weight:600;color:#fde68a}
  .decision .rec{font-size:14px;color:#cbd5e1;margin-top:3px}
  .readynote{color:#4ade80;font-size:13px;margin-top:6px}
  details{margin-top:10px;border-top:1px solid #334155;padding-top:8px}
  summary{cursor:pointer;color:#94a3b8;font-size:13px;user-select:none}
  summary:hover{color:#cbd5e1}
  .specbody{margin-top:10px;background:#0f172a;border:1px solid #334155;border-radius:8px;padding:4px 16px;max-height:520px;overflow:auto}
  .specbody h3{font-size:15px;color:#e2e8f0;margin:14px 0 4px}.specbody h4{font-size:13px;color:#cbd5e1;margin:12px 0 3px}
  .specbody p{margin:5px 0;color:#cbd5e1;font-size:13.5px}.specbody li{color:#cbd5e1;font-size:13.5px}
  .specbody code{background:#1e293b;padding:1px 5px;border-radius:4px;font-size:12.5px}
  .specbody pre{background:#1e293b;padding:10px;border-radius:6px;overflow:auto;font-size:12px}
  .specbody hr{border:none;border-top:1px solid #334155;margin:10px 0}
  .eitem{font-size:12.5px;color:#94a3b8;margin:4px 0}.eitem.un{color:#fca5a5}
</style></head><body><div class="wrap">
  <h1>${esc(title)}</h1>
  <div class="sub">target: ${esc(data.target || "")} · ${totals.n} artifact(s)</div>
  <div class="totals">
    <div class="stat"><b style="color:#fbbf24">${totals.decisions}</b><span>need your call</span></div>
    <div class="stat"><b style="color:#4ade80">${totals.ready}</b><span>ready to implement</span></div>
    <div class="stat"><b>${totals.fixed}</b><span>fixed by the loop</span></div>
  </div>
  <div class="hint">Review at the brief + "needs your call" level. Engineering issues were auto-resolved — expand only if curious.</div>
  ${ordered.map(card).join("\n")}
</div></body></html>`;

writeFileSync(outPath, html);
console.log(JSON.stringify({ ok: true, out: outPath, ...totals }));
