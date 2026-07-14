// Grant (or revoke) early access to the gated product.
//
//   node scripts/grant-early-access.mjs alex@example.com
//   node scripts/grant-early-access.mjs alex@example.com --note "founder"
//   node scripts/grant-early-access.mjs alex@example.com --revoke
//   node scripts/grant-early-access.mjs --list
//   node scripts/grant-early-access.mjs --from-waitlist 25   # oldest 25 signups
//
// The user still has to create an account at /signin — this only says their
// email is allowed through the pre-launch gate once they do.
import postgres from "postgres";

const url =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const valueOf = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};
const emails = args.filter((a) => a.includes("@"));

const sql = postgres(url);

try {
  if (has("--list")) {
    const rows = await sql`
      SELECT email, note, granted_at FROM early_access ORDER BY granted_at`;
    console.log(`${rows.length} with early access:`);
    for (const r of rows) {
      console.log(
        `  ${r.email.padEnd(34)} ${r.granted_at.toISOString().slice(0, 10)}  ${r.note ?? ""}`,
      );
    }
  } else if (has("--from-waitlist")) {
    const n = Number(valueOf("--from-waitlist") ?? 10);
    // Oldest signups first — first in, first let in.
    const picked = await sql`
      SELECT w.email FROM waitlist_signups w
      LEFT JOIN early_access e ON lower(e.email) = lower(w.email)
      WHERE e.email IS NULL
      ORDER BY w.created_at
      LIMIT ${n}`;
    if (!picked.length) {
      console.log("No un-granted waitlist signups.");
    } else {
      await sql`
        INSERT INTO early_access ${sql(
          picked.map((p) => ({ email: p.email.toLowerCase(), note: "waitlist" })),
        )}
        ON CONFLICT (email) DO NOTHING`;
      console.log(`Granted ${picked.length} from the waitlist:`);
      for (const p of picked) console.log(`  ${p.email}`);
    }
  } else if (has("--revoke")) {
    if (!emails.length) throw new Error("Pass an email to revoke.");
    for (const e of emails) {
      await sql`DELETE FROM early_access WHERE lower(email) = lower(${e})`;
      console.log(`revoked ${e}`);
    }
  } else {
    if (!emails.length) {
      console.log(
        "Usage: node scripts/grant-early-access.mjs <email> [--note X] [--revoke] | --list | --from-waitlist N",
      );
      process.exit(1);
    }
    const note = valueOf("--note") ?? null;
    for (const e of emails) {
      await sql`
        INSERT INTO early_access (email, note) VALUES (${e.toLowerCase()}, ${note})
        ON CONFLICT (email) DO NOTHING`;
      console.log(`granted ${e.toLowerCase()}`);
    }
  }

  const n = await sql`SELECT count(*)::int AS n FROM early_access`;
  console.log(`\ntotal with access: ${n[0].n}`);
} catch (e) {
  console.error("ERR", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
