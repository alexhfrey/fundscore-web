import type { NextConfig } from "next";

// ---------------------------------------------------------------------------
// Production-database guard — placed HERE, not in package.json, on purpose.
//
// H3 shipped this refusal inside `scripts/next-env-guard.mjs`, wired to the
// `npm run build` / `npm run start` scripts. Within the hour an agent ran
// `npx next start` — the obvious alternative invocation — walked straight past
// it, and pointed a test server at PRODUCTION for ~290 requests. (Nothing
// persisted: the connection failed auth and prod has no ops tables. It was
// still real traffic against prod.)
//
// That is the same lesson `drizzle.config.ts` already carries one file over:
// a guard on the npm script only guards the npm script. Next loads THIS file
// in-process for build, start and dev regardless of how it was invoked, so a
// refusal here cannot be routed around.
//
// Division of labour: the wrapper still PROMOTES .env.local over
// .env.production.local (it must run before Next reads env at all, which this
// file cannot). This is the backstop that refuses when that promotion did not
// happen — belt and braces, not a duplicate.
// ---------------------------------------------------------------------------
function assertNotProductionDatabase() {
  // On Vercel the platform env is authoritative and pointing at production is
  // the entire point. Same signal the wrapper and portfolio-solver.ts use.
  if (process.env.VERCEL) return;
  // `next dev` never loads .env.production.local, so it was never exposed.
  if (process.env.NODE_ENV !== "production") return;

  const url = process.env.DATABASE_URL;
  if (!url) return; // the wrapper owns the "no database named" refusal.

  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return; // unparseable is the wrapper's problem to report, not ours.
  }
  // A deliberately named remote target is allowed — the wrapper's own rule is that an
  // explicit shell export outranks the files, and refusing here would make the two layers
  // disagree about the same command (`DATABASE_URL=<preview> npm run build` promoted fine
  // and would then be refused by this backstop). Purpose-named rather than overloading
  // VERCEL, which means "this is a deployment", not "I meant this database".
  if (process.env.ALLOW_REMOTE_DB === "1") return;

  // Local is the only host a local production-mode command may talk to. URL.hostname keeps
  // the brackets on an IPv6 literal, so `postgres://[::1]:5432/x` arrives as "[::1]".
  if (["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) return;

  throw new Error(
    [
      "",
      "  ✖ Refusing to run a local production-mode Next command against a REMOTE database.",
      `      host: ${host}`,
      "",
      "  This is almost always `npx next build` / `npx next start`, which skip the",
      "  env guard wired into the npm scripts. Use `npm run build` / `npm run start`,",
      "  which promote .env.local over .env.production.local — or pass one explicitly:",
      "      DATABASE_URL='postgres://…' npm run build",
      "",
      "  If you genuinely mean this remote database — building against preview, say —",
      "  set ALLOW_REMOTE_DB=1. (VERCEL=1 also passes, but that claims to BE a deployment.)",
      "",
    ].join("\n"),
  );
}

assertNotProductionDatabase();

const nextConfig: NextConfig = {
  // DuckDB ships a native addon; keep it external so Next doesn't try to bundle
  // the .node binary into the server build (serving_architecture Decision 6:
  // the screener path runs DuckDB-on-Parquet in the Node runtime, never bundled).
  serverExternalPackages: ["@duckdb/node-api", "@duckdb/node-bindings"],
};

export default nextConfig;
