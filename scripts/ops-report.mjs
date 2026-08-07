// The beta ops readout: what did people look at, what broke, what did they say.
//
// This is deliberately a CLI rather than an admin page — for a beta of dozens
// of invited users, the owner needs the numbers, not a dashboard to maintain.
// Point DATABASE_URL at local, preview or production.
//
//   node scripts/ops-report.mjs            # last 7 days
//   node scripts/ops-report.mjs --days 30
import postgres from "postgres";

const url =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const argv = process.argv.slice(2);
const daysArg = argv.indexOf("--days");
const DAYS = daysArg >= 0 ? Number(argv[daysArg + 1]) : 7;
if (!Number.isFinite(DAYS) || DAYS <= 0) {
  console.error("--days must be a positive number");
  process.exit(1);
}

const sql = postgres(url);

function section(title) {
  console.log(`\n=== ${title} ===`);
}

try {
  const missing = await sql`
    SELECT unnest(ARRAY['ops_pageviews','ops_error_events','ops_feedback']) AS t
    EXCEPT
    SELECT table_name FROM information_schema.tables WHERE table_schema='public'`;
  if (missing.length) {
    console.error(
      `Missing tables: ${missing.map((r) => r.t).join(", ")}. ` +
        `Run: node scripts/apply-ops-schema.mjs`,
    );
    process.exit(1);
  }

  console.log(`FundScore beta ops — last ${DAYS} day(s)`);

  section("Pageviews by day");
  const byDay = await sql`
    SELECT date_trunc('day', viewed_at)::date AS day,
           count(*)::int AS views,
           count(DISTINCT user_email)::int AS signed_in_users
    FROM public.ops_pageviews
    WHERE viewed_at > now() - (${DAYS} || ' days')::interval
    GROUP BY 1 ORDER BY 1 DESC`;
  if (!byDay.length) console.log("(none)");
  for (const r of byDay) {
    console.log(
      `  ${r.day.toISOString().slice(0, 10)}  ${String(r.views).padStart(6)} views  ${String(
        r.signed_in_users,
      ).padStart(4)} signed-in users`,
    );
  }

  section("Top paths");
  const byPath = await sql`
    SELECT path, count(*)::int AS views
    FROM public.ops_pageviews
    WHERE viewed_at > now() - (${DAYS} || ' days')::interval
    GROUP BY 1 ORDER BY 2 DESC LIMIT 25`;
  if (!byPath.length) console.log("(none)");
  for (const r of byPath) {
    console.log(`  ${String(r.views).padStart(6)}  ${r.path}`);
  }

  section("Errors");
  const errs = await sql`
    SELECT occurred_at, source, route, user_email, message
    FROM public.ops_error_events
    WHERE occurred_at > now() - (${DAYS} || ' days')::interval
    ORDER BY occurred_at DESC LIMIT 40`;
  if (!errs.length) console.log("(none)");
  for (const r of errs) {
    console.log(
      `  ${r.occurred_at.toISOString()}  [${r.source}]  ${r.route ?? "?"}  ${
        r.user_email ?? "anon"
      }\n      ${(r.message ?? "").split("\n")[0]}`,
    );
  }

  section("Feedback");
  const fb = await sql`
    SELECT created_at, path, user_email, message
    FROM public.ops_feedback
    WHERE created_at > now() - (${DAYS} || ' days')::interval
    ORDER BY created_at DESC LIMIT 40`;
  if (!fb.length) console.log("(none)");
  for (const r of fb) {
    console.log(
      `  ${r.created_at.toISOString()}  ${r.path ?? "?"}  ${r.user_email ?? "anon"}\n      ${r.message.replace(
        /\n/g,
        "\n      ",
      )}`,
    );
  }
  console.log("");
} catch (e) {
  console.error("ERR", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
