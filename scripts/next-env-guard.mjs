#!/usr/bin/env node
// ============================================================================
// next-env-guard — run a NODE_ENV=production Next command against an honest
// database.  Usage: `node scripts/next-env-guard.mjs <build|start> [args…]`
// (wired to `npm run build` and `npm start`).
// ----------------------------------------------------------------------------
// THE DEFECT THIS EXISTS FOR (found 2026-08-07):
//   Next loads env files in the order
//       .env.production.local > .env.local > .env.production > .env
//   and BOTH `next build` and `next start` run with NODE_ENV=production. So on
//   any machine that has a `.env.production.local` — which is where the operator
//   keeps the prod Supabase pooler credentials for the serving-load runbook —
//   every local `npm run build` resolved DATABASE_URL to PRODUCTION and opened
//   read queries against it. Nobody asked for that, nothing said it was
//   happening, and the gate's own output was misleading as a result: prod has no
//   query tables, so /q/[slug] prerendered 0 paths and that read as a code
//   regression. `npm start` had the same defect at RUNTIME — a local production
//   server would have served prod rows — which is why both go through here.
//   (`next dev` was never affected: NODE_ENV=development never loads
//   `.env.production.local`.)
//
// THE MECHANISM:
//   A build is either DEPLOYED or LOCAL, and the two want opposite things.
//     * DEPLOYED (Vercel): the platform injects the env. `.env*` is gitignored,
//       so none of those files even exist on the build host. Touch nothing.
//     * LOCAL: `.env.local` is the developer's stated intent for this checkout.
//       Promote its keys into the child process env, where Next's loader will
//       NOT override them (@next/env never overwrites an existing process.env
//       entry) — so `.env.local` wins over `.env.production.local`, which is
//       the precedence a human expects and the inverse of what Next does.
//
//   The two branches are told apart by `process.env.VERCEL`, the same signal
//   `src/lib/serving/portfolio-solver.ts` uses to fail closed on a deployed
//   host. That check cannot silently regress in EITHER direction:
//     * If Vercel ever stopped setting VERCEL, this takes the LOCAL branch,
//       finds no `.env.local` on the build host, and fails loudly (below) —
//       fail-closed, not a silent fallback to some other database.
//     * If a local machine ever set VERCEL, that is an explicit act, and the
//       build banner still names the host it resolved.
//
//   An explicit shell-level export always wins over `.env.local`, matching
//   scripts/check-serving-schema.mjs:
//       DATABASE_URL='postgres://…' npm run build
//
//   Every build, local or deployed, prints the database it is about to use as
//   `host:port/dbname`. Never credentials.
//
// This file does NOT read, write or require `.env.production.local` for its own
// operation; it only lists the KEY NAMES that file would otherwise have won, so
// the shadowing is visible. No value from it is ever printed.
// ============================================================================
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { config } from "dotenv";

const LOCAL_ENV = ".env.local";
const DEPLOY_ENV = ".env.production.local";
const ALLOWED = ["build", "start"];

const argv = process.argv.slice(2);
const command = argv[0];
if (!ALLOWED.includes(command)) {
  console.error(
    `  ✖ next-env-guard: expected one of ${ALLOWED.join(", ")}, got ${command ?? "(nothing)"}.\n` +
      "    Usage: node scripts/next-env-guard.mjs <build|start> [args…]",
  );
  process.exit(1);
}

/** `host:port/dbname` — never the credentials. Mirrors describeDbHost() in
 *  src/lib/db/index.ts; duplicated because these scripts run on plain Node and
 *  cannot import the TypeScript module (@types/node ^20 floor, see
 *  scripts/check-serving-schema.mjs). */
function describeHost(url) {
  if (!url) return "(DATABASE_URL is unset)";
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || "5432"}${u.pathname}`;
  } catch {
    return "(DATABASE_URL is not a parseable URL)";
  }
}

function parseEnvFile(path) {
  const out = {};
  config({ path, processEnv: out, quiet: true });
  return out;
}

/**
 * Expand `$VAR` / `${VAR}` the way Next does before promoting a value.
 *
 * Next runs dotenv-expand over its env files. Promoting a RAW value would hand the child a
 * literal `$FOO`, and because Next never overwrites an existing key the child would then
 * quietly use a different value than a plain `next build` — the guard would be changing
 * semantics rather than only changing precedence. dotenv-expand is not a dependency here
 * (checked), so this covers the forms Next supports rather than adding one.
 *
 * `\$` escapes. An unknown name expands to empty, matching dotenv-expand.
 */
function expandValue(value, scope) {
  return value.replace(/\\\$|\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g,
    (match, braced, bare) => (match === "\\$" ? "$" : (scope[braced || bare] ?? "")));
}

const env = { ...process.env };
const deployed = Boolean(process.env.VERCEL);
const lines = [];

if (deployed) {
  lines.push(
    `  next ${command}: DEPLOYED (VERCEL=${process.env.VERCEL}) — env comes from the platform, untouched`,
  );
} else {
  // An explicitly exported DATABASE_URL IS the operator stating the target — which is the
  // very remedy the refusal below recommends, so refusing it anyway made the message
  // self-contradictory and blocked a fresh checkout or a CI runner that has no .env.local.
  // Honour it, but say plainly what this path does NOT cover: only DATABASE_URL is stated,
  // so any NEXT_PUBLIC_* still resolve down the normal chain — and those get inlined into
  // the client bundle, which is the sharper half of the defect this guard exists to close.
  if (!existsSync(LOCAL_ENV) && process.env.DATABASE_URL) {
    lines.push(
      `  next ${command}: LOCAL — no ${LOCAL_ENV}; using the DATABASE_URL you exported`,
      `  ⚠ only DATABASE_URL is pinned. NEXT_PUBLIC_* fall through to .env.production.local`,
      `    if present, and Next INLINES those into the client bundle. Create ${LOCAL_ENV}`,
      "    to pin them too (docs/RUNBOOK-serving-load.md § 9).",
    );
  } else if (!existsSync(LOCAL_ENV)) {
    console.error(
      [
        "",
        `  ✖ Local \`next ${command}\` refused: ${LOCAL_ENV} is missing.`,
        "",
        "    A local production-mode command must state which database it uses. Without",
        "    this file the only DATABASE_URL in scope would be whatever",
        "    .env.production.local / .env supply — i.e. production — which is never",
        "    what a local build or a local server wants.",
        "",
        `    Create ${LOCAL_ENV} (variable inventory: docs/RUNBOOK-serving-load.md § 9), or pass one`,
        `    explicitly:  DATABASE_URL='postgres://…' npm run ${command}`,
        "",
        "    If you are seeing this ON a deployment host, the VERCEL environment",
        "    variable is not set and this guard has correctly refused to guess.",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }

  // May be absent on the exported-DATABASE_URL path above; the loop below then simply
  // promotes nothing, and the env the child inherits is the one the operator exported.
  const local = existsSync(LOCAL_ENV) ? parseEnvFile(LOCAL_ENV) : {};
  const shadowed = existsSync(DEPLOY_ENV) ? parseEnvFile(DEPLOY_ENV) : {};
  const promoted = [];
  const overridden = [];

  for (const [key, value] of Object.entries(local)) {
    // An explicit shell export is a deliberate choice; it outranks the file.
    if (process.env[key] !== undefined) continue;
    // Scope is the WHOLE file underneath the live env, so a value may reference a key
    // defined LATER in the file (dotenv-expand resolves against the file, not just what has
    // been promoted so far) while an explicit shell export still wins.
    env[key] = expandValue(value, { ...local, ...env });
    promoted.push(key);
    if (key in shadowed) overridden.push(key);
  }

  // THE invariant, enforced where it actually holds rather than where the file happens to
  // exist: a local production-mode command must NAME its database. Checking only for
  // `.env.local`'s presence left the original defect wide open — a file that exists but
  // omits DATABASE_URL promotes nothing, Next falls through to .env.production.local, and
  // the build talks to production again while the banner cheerfully prints
  // "(DATABASE_URL is unset)". Refuse instead.
  if (!env.DATABASE_URL) {
    console.error(
      [
        "",
        `  ✖ Local \`next ${command}\` refused: no DATABASE_URL in scope.`,
        "",
        `    ${LOCAL_ENV} exists but does not set it, and nothing was exported. Next would`,
        "    fall through to .env.production.local — i.e. production — which is never what a",
        "    local build or a local server wants.",
        "",
        `    Add DATABASE_URL to ${LOCAL_ENV}, or pass one:`,
        `      DATABASE_URL='postgres://…' npm run ${command}`,
        "",
      ].join("\n"),
    );
    process.exit(1);
  }

  // Suppressed on the exported-DATABASE_URL path, which already said its piece — a banner
  // that then adds "0 keys from .env.local" reads like a second, contradictory verdict.
  if (existsSync(LOCAL_ENV)) {
    lines.push(`  next ${command}: LOCAL — ${promoted.length} keys from ${LOCAL_ENV}`);
  }
  if (overridden.length > 0) {
    lines.push(
      `             ${overridden.length} of them outrank ${DEPLOY_ENV} (Next's own order is the reverse): ${overridden.join(", ")}`,
    );
  }
}

lines.push(`  database:  ${describeHost(env.DATABASE_URL)}`);
console.log(["", ...lines, ""].join("\n"));

const result = spawnSync("node_modules/.bin/next", argv, {
  stdio: "inherit",
  env,
});

if (result.error) {
  console.error(`  ✖ could not run next ${command}: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
