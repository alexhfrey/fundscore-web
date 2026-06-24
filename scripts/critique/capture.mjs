#!/usr/bin/env node
/**
 * capture.mjs — Stage A of the feature-critique pipeline.
 *
 * For one page target, produces a deterministic capture bundle that the critic
 * agents read:
 *   feature-pipeline/captures/<slug>/
 *     screenshot.png         full-page desktop render (1280w)
 *     screenshot-mobile.png  full-page mobile render (390w) — for the design critic
 *     text.txt               visible text (body.innerText)
 *     sources.json           the source files that back this route
 *     served_facts.json      the row the page renders from (fund_profile_facts)
 *     meta.json              route, url, slug, target, captured timing, warnings
 *
 * Usage:
 *   node scripts/critique/capture.mjs --page-type fund_profile --ticker FCNTX
 *   node scripts/critique/capture.mjs --route /funds/FCNTX --slug fund_profile__FCNTX
 *   [--base-url http://localhost:3000]
 *
 * Requires the dev server running (`npm run dev`) and DATABASE_URL reachable
 * (for served_facts.json). Reads config from feature-pipeline/config/page-types.json.
 */
import { chromium } from "playwright";
import postgres from "postgres";
import dotenv from "dotenv";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), "..", "..");
dotenv.config({ path: path.join(REPO_ROOT, ".env.local") });

const CONFIG_PATH = path.join(REPO_ROOT, "feature-pipeline", "config", "page-types.json");
const CAPTURES_DIR = path.join(REPO_ROOT, "feature-pipeline", "captures");

// ---- arg parsing ---------------------------------------------------------
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) out[a.slice(2)] = argv[i + 1]?.startsWith("--") || argv[i + 1] === undefined ? true : argv[++i];
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));
const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
const baseUrl = (args["base-url"] || "http://localhost:3000").replace(/\/$/, "");

const pageType = args["page-type"] || "fund_profile";
const ptConfig = config.page_types[pageType];
if (!ptConfig) {
  console.error(`Unknown page-type "${pageType}". Known: ${Object.keys(config.page_types).join(", ")}`);
  process.exit(1);
}

const ticker = args.ticker ? String(args.ticker).toUpperCase() : null;
const route = args.route || (ticker ? ptConfig.route_template.replace("{ticker}", ticker) : null);
if (!route) {
  console.error("Provide --ticker <T> (with --page-type) or --route </path>.");
  process.exit(1);
}
const target = ticker || route.replace(/\//g, "_").replace(/^_/, "");
const slug = args.slug || `${pageType}__${target}`;
const outDir = path.join(CAPTURES_DIR, slug);
mkdirSync(outDir, { recursive: true });

const warnings = [];

// ---- helpers -------------------------------------------------------------
function expandSourceFiles(patterns) {
  const files = [];
  const walk = (abs, rel) => {
    for (const name of readdirSync(abs)) {
      const childAbs = path.join(abs, name);
      const childRel = path.join(rel, name);
      if (statSync(childAbs).isDirectory()) walk(childAbs, childRel);
      else if (/\.(tsx?|jsx?)$/.test(name)) files.push(childRel);
    }
  };
  for (const p of patterns) {
    const abs = path.join(REPO_ROOT, p);
    if (!existsSync(abs)) { warnings.push(`source path missing: ${p}`); continue; }
    if (statSync(abs).isDirectory()) walk(abs, p);
    else files.push(p);
  }
  return files;
}

async function fetchServedFacts() {
  if (pageType !== "fund_profile" || !ticker) return { skipped: `served_facts only wired for fund_profile+ticker` };
  const url = process.env.DATABASE_URL;
  if (!url) { warnings.push("DATABASE_URL not set — served_facts.json will be null"); return null; }
  const sql = postgres(url, { max: 1 });
  try {
    const tickerCol = ptConfig.ground_truth.ticker_column;
    const table = ptConfig.ground_truth.served_table;
    const rows = await sql.unsafe(
      `SELECT * FROM ${table} WHERE ${tickerCol} = $1 LIMIT 1`,
      [ticker]
    );
    if (rows.length === 0) { warnings.push(`no ${table} row for ${ticker}`); return null; }
    return rows[0];
  } catch (e) {
    warnings.push(`served_facts query failed: ${e.message}`);
    return null;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function captureViewport(browser, width, height, file, fullPage = true) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  const url = `${baseUrl}${route}`;
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
  } catch {
    warnings.push(`networkidle timed out at ${width}w; falling back to 'load'`);
    await page.goto(url, { waitUntil: "load", timeout: 45000 }).catch((e) => warnings.push(`goto failed: ${e.message}`));
  }
  await page.waitForTimeout(800); // let client charts settle
  await page.screenshot({ path: path.join(outDir, file), fullPage });
  let text = "";
  try { text = await page.locator("body").innerText(); } catch (e) { warnings.push(`innerText failed: ${e.message}`); }
  const status = page.url();
  await ctx.close();
  return { text, finalUrl: status };
}

// ---- run -----------------------------------------------------------------
(async () => {
  const browser = await chromium.launch({ headless: true });
  let desktop, finalUrl;
  try {
    const d = await captureViewport(browser, 1280, 900, "screenshot.png", true);
    desktop = d.text;
    finalUrl = d.finalUrl;
    await captureViewport(browser, 390, 844, "screenshot-mobile.png", true);
  } finally {
    await browser.close();
  }

  writeFileSync(path.join(outDir, "text.txt"), desktop || "", "utf8");

  const sources = expandSourceFiles(ptConfig.source_files || []);
  writeFileSync(path.join(outDir, "sources.json"), JSON.stringify({ page_type: pageType, route, files: sources }, null, 2));

  const facts = await fetchServedFacts();
  writeFileSync(path.join(outDir, "served_facts.json"), JSON.stringify(facts, null, 2));

  const meta = {
    slug, page_type: pageType, target, route, url: `${baseUrl}${route}`, final_url: finalUrl,
    base_url: baseUrl, viewport_desktop: "1280x900", viewport_mobile: "390x844",
    text_chars: (desktop || "").length, source_file_count: sources.length,
    served_facts_present: facts != null && !facts.skipped, warnings,
  };
  writeFileSync(path.join(outDir, "meta.json"), JSON.stringify(meta, null, 2));

  console.log(JSON.stringify({ ok: true, slug, outDir, ...meta }, null, 2));
  if (warnings.length) console.error(`captured with ${warnings.length} warning(s):\n - ${warnings.join("\n - ")}`);
})().catch((e) => {
  console.error("capture failed:", e);
  process.exit(1);
});
