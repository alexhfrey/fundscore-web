// ============================================================================
// Refusal for drizzle-kit's schema-mutating subcommands.
// ----------------------------------------------------------------------------
// drizzle-kit push is the "obvious way" to create this project's tables, and it
// is wrong for every one of them. Measured 2026-08-07 against an empty database:
// push creates all six serving tables with ROW LEVEL SECURITY OFF, and on
// Supabase they inherit anon/authenticated full-DML grants — the PAID holdings
// and attribution payloads become readable, and truncatable, with the public
// anon key. It also cannot express the auth-schema foreign keys, the own-row
// policies, or the new-user trigger. `tablesFilter` does NOT help: it filters
// what push reads back, not what it creates (verified, not assumed).
//
// CommonJS on purpose. drizzle.config.ts is require()d by drizzle-kit, and
// `npm run db:push` runs it on plain Node — .cjs is the one format both load
// without a version floor.
// ============================================================================
const REFUSED = new Set(["push", "migrate"]);

const MESSAGE = `
drizzle-kit push is disabled in this project.

It creates tables without the row-level security, grants, foreign keys and
triggers they need — on Supabase that exposes paid serving payloads through the
public anon key. Use the owner of the table you are changing:

  serving tables       fund_score  uv run python scripts/pipeline/apply_serving_schema.py
    (fund_profile_facts, fund_holdings_full, fund_attribution_blocks,
     serving_manifest, query_canonical_catalog, query_canonical_results)
  users, entitlements  fund_score  uv run python scripts/pipeline/apply_auth_schema.py
  lenses, snapshots    node scripts/apply-lens-schema.mjs
  ops_*                node scripts/apply-ops-schema.mjs
  waitlist_signups     node scripts/apply-waitlist-schema.mjs
  early_access         node scripts/apply-early-access-schema.mjs

The Drizzle schema in src/lib/db/schema/ is a READ-ONLY typed mirror of those.
After changing a table, mirror it there and verify with:

  npm run db:check-serving

See docs/RUNBOOK-serving-load.md § 3.1.
`;

/** Exit 1 with an explanation if argv names a schema-mutating subcommand. */
function refuseIfSchemaMutatingCommand(argv) {
  // Scan EVERY argument for a refused subcommand rather than trying to identify
  // "the subcommand" positionally. The positional form — first token that does
  // not start with "-" — is bypassed by any global option that takes a separate
  // value: `drizzle-kit --config drizzle.config.ts push` makes the config PATH
  // look like the subcommand, the guard returns, and push reaches the database.
  // That is the exact operation this file exists to prevent, so the parse must
  // not be the weak link.
  //
  // Scanning can only ever over-refuse (an argument VALUE that is exactly
  // "push" or "migrate"), which is the safe direction for a guard and is not a
  // shape that occurs here: `export`, the one subcommand we must let through,
  // is not in REFUSED, and no path in this repo is named exactly "push".
  const refused = (argv || []).slice(2).find((a) => REFUSED.has(a));
  if (!refused) return;
  console.error(MESSAGE);
  process.exit(1);
}

module.exports = { MESSAGE, REFUSED, refuseIfSchemaMutatingCommand };
