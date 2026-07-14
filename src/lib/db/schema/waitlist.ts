import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

// ============================================================================
// WAITLIST — pre-launch signups from the marketing surface.
// Not a serving table: written by the app, never loaded from the lakehouse.
// ============================================================================

/**
 * The early-access allowlist. Being signed in is NOT enough to pass the
 * pre-launch gate — Supabase signup is self-serve, so "any logged-in user"
 * would mean "anyone who spent ten seconds making an account". A user reaches
 * the product only if their email is in here.
 *
 * Granting access is one INSERT (see scripts/grant-early-access.mjs), which is
 * exactly the "opening in stages" flow the landing page promises.
 */
export const earlyAccess = pgTable(
  "early_access",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 320 }).notNull().unique(),
    note: text("note"),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("early_access_email_idx").on(table.email)],
);

export const waitlistSignups = pgTable(
  "waitlist_signups",
  {
    id: serial("id").primaryKey(),
    // Stored lowercased + trimmed; unique so a repeat signup is idempotent.
    email: varchar("email", { length: 320 }).notNull().unique(),
    // Which surface the signup came from (e.g. "coming-soon-hero").
    source: text("source"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("waitlist_signups_created_at_idx").on(table.createdAt)],
);
