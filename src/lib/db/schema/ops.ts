import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

// ============================================================================
// BETA OPS — error events, user feedback, pageviews.
//
// Not serving tables: written by the app at runtime, never loaded from the
// lakehouse, never read by a fund page. Same category as waitlist_signups /
// early_access. Nothing here can influence a displayed figure.
//
// Deliberately first-party rather than a third-party tracker: the beta must be
// observable without the owner provisioning a DSN or an API key, and Vercel's
// Hobby log retention is too short to be the only record of a beta user's
// crash. DDL lives in scripts/apply-ops-schema.mjs (drizzle push hangs against
// Supabase's pooler).
// ============================================================================

/**
 * Uncaught errors, from both sides of the wire.
 *
 * `source` is 'server' (Next's onRequestError — RSC render, server action or
 * route handler) or 'client' (an error boundary reporting through /api/ops).
 * Every column except `occurred_at`/`source` is nullable on purpose: a report
 * that arrives with half the context is still worth keeping, and an error
 * reporter must never reject the thing it is reporting on.
 */
export const opsErrorEvents = pgTable(
  "ops_error_events",
  {
    id: serial("id").primaryKey(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    source: varchar("source", { length: 16 }).notNull(),
    // The route/path the error happened on, as reported by Next or the client.
    route: text("route"),
    // Next's error digest, when there is one — the only handle a user-visible
    // production error screen gives you back.
    digest: varchar("digest", { length: 128 }),
    message: text("message"),
    stack: text("stack"),
    // Which beta user hit it, when there is a session. Never inferred.
    userEmail: varchar("user_email", { length: 320 }),
    userAgent: text("user_agent"),
  },
  (table) => [index("ops_error_events_occurred_at_idx").on(table.occurredAt)],
);

/**
 * The beta feedback channel. `path` is captured automatically by the widget so
 * "this page is confusing" arrives attached to the page it is about.
 */
export const opsFeedback = pgTable(
  "ops_feedback",
  {
    id: serial("id").primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    message: text("message").notNull(),
    path: text("path"),
    // The signed-in email if there is a session, else whatever the user chose
    // to type, else null. Never fabricated.
    userEmail: varchar("user_email", { length: 320 }),
    userAgent: text("user_agent"),
  },
  (table) => [index("ops_feedback_created_at_idx").on(table.createdAt)],
);

/**
 * One row per client-side navigation. No IP address is stored — the useful
 * beta question is "did the people we invited open a fund page?", which the
 * session email answers, and an IP would add tracking surface for nothing.
 */
export const opsPageviews = pgTable(
  "ops_pageviews",
  {
    id: serial("id").primaryKey(),
    viewedAt: timestamp("viewed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    path: text("path").notNull(),
    referrer: text("referrer"),
    userEmail: varchar("user_email", { length: 320 }),
    userAgent: text("user_agent"),
  },
  (table) => [
    index("ops_pageviews_viewed_at_idx").on(table.viewedAt),
    index("ops_pageviews_path_idx").on(table.path),
  ],
);
