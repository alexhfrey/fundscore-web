// ============================================================================
// Lens persistence + slug + change-tracking (query_results.md § 7, T6).
// ----------------------------------------------------------------------------
// A Lens is an authenticated user's saved canonical query (the /q/{slug} spec,
// personally named) with opt-in change-tracking. Per serving_architecture.md
// Decision 1, accounts / Lenses are the ROW-KEYED hot path → Supabase Postgres
// via Drizzle (NOT the DuckDB screener path). This module owns the lens CRUD,
// the snapshot capture, and the honest entered/left diff.
//
// Data integrity: the ranking itself is NEVER stored here. A Lens stores only
// the query spec (definition) + an immutable list of result-set MEMBERS at each
// capture. /lens/{lens_slug} always re-runs the SAME screener path that powers
// the public /q/{slug}. The diff compares two real captured membership sets;
// the first capture (at save) has no prior, so a fresh Lens shows 0 changes.
// ============================================================================
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { lenses, lensSnapshots } from "../db/schema/serving";
import { getQueryBySlug } from "./screener";
import type { UserState } from "./profile";

// Per-tier saved-Lens quota (query_results.md § Access/Gating). Free = up to 3;
// paid + pro = unlimited (null). Anonymous cannot save (no session).
const LENS_QUOTA: Record<UserState, number | null> = {
  anonymous: 0,
  free: 3,
  paid: null,
  pro: null,
};

// Cap snapshots retained per Lens so visit-driven captures don't grow unbounded.
// We always keep the FIRST snapshot (the save baseline) + the most recent ones.
const MAX_SNAPSHOTS = 30;

export interface LensDefinition {
  query_slug: string; // underlying canonical /q/{slug}
  parsed_query_text: string;
  query_type: string;
  parsed_spec_hash: string | null;
  as_of: string | null;
}

export interface LensRow {
  id: string;
  userId: string;
  lensSlug: string;
  slug: string;
  name: string;
  note: string | null;
  changeTracking: boolean;
  definition: LensDefinition;
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotRow {
  id: string;
  lensId: string;
  capturedAt: string;
  resultAsOf: string | null;
  memberCount: number;
  memberSeriesIds: string[];
  memberMeta: Record<string, { ticker: string; name: string }>;
}

export interface LensDiff {
  hasPrior: boolean; // false right after save → 0 changes, honestly
  priorCapturedAt: string | null;
  entered: { series_id: string; ticker: string; name: string }[];
  left: { series_id: string; ticker: string; name: string }[];
  unchangedCount: number;
}

export interface QuotaState {
  used: number;
  limit: number | null; // null = unlimited
  exhausted: boolean;
}

// --- slug minting -----------------------------------------------------------
// A lens_slug is a stable, opaque-ish public handle: a short human-readable stem
// from the query slug + a random suffix for uniqueness/unguessability. Distinct
// from the underlying /q/{slug} so two users saving the same query get different
// shareable Lens links.
function randSuffix(): string {
  // 8 hex chars from crypto — collision-safe at this scale, not guessable.
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function stem(querySlug: string): string {
  // Take the human-readable part of the canonical slug, drop its trailing hash.
  const cleaned = querySlug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
  // canonical slugs end in `-{8hex}`; strip it for a cleaner lens stem.
  const noHash = cleaned.replace(/-[0-9a-f]{8}$/i, "");
  const words = (noHash || cleaned).split("-").slice(0, 6).join("-");
  return words || "lens";
}

async function mintLensSlug(querySlug: string): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const candidate = `${stem(querySlug)}-${randSuffix()}`;
    const [hit] = await db
      .select({ id: lenses.id })
      .from(lenses)
      .where(eq(lenses.lensSlug, candidate))
      .limit(1);
    if (!hit) return candidate;
  }
  // Vanishingly unlikely fallthrough; longer suffix guarantees uniqueness.
  return `${stem(querySlug)}-${randSuffix()}${randSuffix()}`;
}

// --- quota ------------------------------------------------------------------
export async function getQuotaState(
  userId: string,
  userState: UserState,
): Promise<QuotaState> {
  const limit = LENS_QUOTA[userState];
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(lenses)
    .where(eq(lenses.userId, userId));
  return { used: n, limit, exhausted: limit != null && n >= limit };
}

// --- snapshot capture -------------------------------------------------------
// Capture the CURRENT ranked membership for a Lens's query by re-running the
// screener (same path as /q/{slug}). Returns the inserted snapshot row, or null
// if the underlying query has no results / no longer resolves (never fabricated).
async function captureSnapshot(lens: LensRow): Promise<SnapshotRow | null> {
  const page = await getQueryBySlug(lens.slug);
  if (!page) return null;
  const memberSeriesIds = page.rows.map((r) => r.series_id);
  const memberMeta: Record<string, { ticker: string; name: string }> = {};
  for (const r of page.rows) {
    memberMeta[r.series_id] = { ticker: r.ticker, name: r.fund_name };
  }
  const [ins] = await db
    .insert(lensSnapshots)
    .values({
      lensId: lens.id,
      resultAsOf: page.catalog.as_of ?? null,
      memberCount: memberSeriesIds.length,
      memberSeriesIds,
      memberMeta,
    })
    .returning();
  await pruneSnapshots(lens.id);
  return coerceSnapshot(ins);
}

// Keep the baseline (oldest) + the most recent MAX_SNAPSHOTS-1 captures.
async function pruneSnapshots(lensId: string): Promise<void> {
  const all = await db
    .select({ id: lensSnapshots.id, capturedAt: lensSnapshots.capturedAt })
    .from(lensSnapshots)
    .where(eq(lensSnapshots.lensId, lensId))
    .orderBy(asc(lensSnapshots.capturedAt));
  if (all.length <= MAX_SNAPSHOTS) return;
  // Drop the middle: keep index 0 (baseline) and the last MAX_SNAPSHOTS-1.
  const keep = new Set<string>([
    all[0].id,
    ...all.slice(all.length - (MAX_SNAPSHOTS - 1)).map((s) => s.id),
  ]);
  const toDrop = all.filter((s) => !keep.has(s.id)).map((s) => s.id);
  for (const id of toDrop) {
    await db.delete(lensSnapshots).where(eq(lensSnapshots.id, id));
  }
}

// --- create -----------------------------------------------------------------
export interface SaveLensInput {
  userId: string;
  querySlug: string; // canonical /q/{slug} to save
  name: string;
  note?: string | null;
  changeTracking?: boolean;
}

export type SaveLensResult =
  | { ok: true; lens: LensRow }
  | { ok: false; reason: "quota_exhausted" | "unknown_query" | "empty_name" };

export async function saveLens(
  input: SaveLensInput,
  userState: UserState,
): Promise<SaveLensResult> {
  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, reason: "empty_name" };

  // The query must resolve to a real canonical spec — never persist a phantom.
  const page = await getQueryBySlug(input.querySlug);
  if (!page || page.catalog.query_type === "refusal") {
    return { ok: false, reason: "unknown_query" };
  }

  const quota = await getQuotaState(input.userId, userState);
  if (quota.exhausted) return { ok: false, reason: "quota_exhausted" };

  const lensSlug = await mintLensSlug(input.querySlug);
  const definition: LensDefinition = {
    query_slug: page.catalog.query_slug,
    parsed_query_text: page.catalog.parsed_query_text,
    query_type: page.catalog.query_type,
    parsed_spec_hash: page.catalog.parsed_spec_hash ?? null,
    as_of: page.catalog.as_of ?? null,
  };

  const [row] = await db
    .insert(lenses)
    .values({
      userId: input.userId,
      lensSlug,
      slug: input.querySlug,
      name,
      note: input.note?.trim() || null,
      changeTracking: input.changeTracking ?? true,
      definition,
    })
    .returning();

  const lens = coerceLens(row);
  // Baseline snapshot at save time → first visit shows an honest 0 changes.
  await captureSnapshot(lens);
  return { ok: true, lens };
}

// --- reads ------------------------------------------------------------------
export async function listLenses(userId: string): Promise<LensRow[]> {
  const rows = await db
    .select()
    .from(lenses)
    .where(eq(lenses.userId, userId))
    .orderBy(desc(lenses.createdAt));
  return rows.map(coerceLens);
}

/** Owner read of a Lens by its public slug (used for management + ownership). */
export async function getLensBySlug(lensSlug: string): Promise<LensRow | null> {
  const [row] = await db
    .select()
    .from(lenses)
    .where(eq(lenses.lensSlug, lensSlug))
    .limit(1);
  return row ? coerceLens(row) : null;
}

export async function deleteLens(userId: string, lensSlug: string): Promise<boolean> {
  const res = await db
    .delete(lenses)
    .where(and(eq(lenses.userId, userId), eq(lenses.lensSlug, lensSlug)))
    .returning({ id: lenses.id });
  return res.length > 0;
}

// --- the rendered Lens (spec + current results + honest diff) ---------------
export interface RenderedLens {
  lens: LensRow;
  isOwner: boolean;
  page: NonNullable<Awaited<ReturnType<typeof getQueryBySlug>>>;
  diff: LensDiff | null; // null when change-tracking is off or query unresolved
}

/**
 * Resolve a Lens for rendering. Re-runs the screener for the CURRENT ranking
 * (never stored), and — if the viewer owns the Lens — records a fresh visit
 * snapshot and computes the honest diff against the prior capture. Shared
 * (non-owner) viewers see the current ranking but no per-visit snapshot is
 * written for them (the diff belongs to the owner's tracking, per the spec).
 */
export async function renderLens(
  lens: LensRow,
  viewerUserId: string | null,
): Promise<RenderedLens | null> {
  const page = await getQueryBySlug(lens.slug);
  if (!page || page.catalog.query_type === "refusal") return null;

  const isOwner = viewerUserId != null && viewerUserId === lens.userId;
  let diff: LensDiff | null = null;

  if (isOwner && lens.changeTracking) {
    // Prior = the latest existing snapshot BEFORE this visit's capture.
    const prior = await latestSnapshot(lens.id);
    const fresh = await captureSnapshot(lens);
    diff = computeDiff(prior, fresh);
  }

  return { lens, isOwner, page, diff };
}

async function latestSnapshot(lensId: string): Promise<SnapshotRow | null> {
  const [row] = await db
    .select()
    .from(lensSnapshots)
    .where(eq(lensSnapshots.lensId, lensId))
    .orderBy(desc(lensSnapshots.capturedAt))
    .limit(1);
  return row ? coerceSnapshot(row) : null;
}

// Deterministic, honest set diff between prior and current membership. With no
// prior (fresh save) the diff is empty → "0 changes since you saved this".
function computeDiff(
  prior: SnapshotRow | null,
  current: SnapshotRow | null,
): LensDiff {
  if (!prior || !current) {
    return {
      hasPrior: false,
      priorCapturedAt: null,
      entered: [],
      left: [],
      unchangedCount: current?.memberCount ?? 0,
    };
  }
  const priorSet = new Set(prior.memberSeriesIds);
  const currentSet = new Set(current.memberSeriesIds);

  const entered = current.memberSeriesIds
    .filter((id) => !priorSet.has(id))
    .map((id) => ({ series_id: id, ...metaOf(current, id) }));
  const left = prior.memberSeriesIds
    .filter((id) => !currentSet.has(id))
    .map((id) => ({ series_id: id, ...metaOf(prior, id) }));
  const unchangedCount = current.memberSeriesIds.filter((id) =>
    priorSet.has(id),
  ).length;

  return {
    hasPrior: true,
    priorCapturedAt: prior.capturedAt,
    entered,
    left,
    unchangedCount,
  };
}

function metaOf(snap: SnapshotRow, id: string): { ticker: string; name: string } {
  return snap.memberMeta[id] ?? { ticker: id, name: "" };
}

// --- coercion (Drizzle returns Date / unknown jsonb) ------------------------
function coerceLens(row: typeof lenses.$inferSelect): LensRow {
  return {
    id: row.id,
    userId: row.userId,
    lensSlug: row.lensSlug,
    slug: row.slug,
    name: row.name,
    note: row.note ?? null,
    changeTracking: row.changeTracking,
    definition: row.definition as LensDefinition,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function coerceSnapshot(row: typeof lensSnapshots.$inferSelect): SnapshotRow {
  return {
    id: row.id,
    lensId: row.lensId,
    capturedAt: toIso(row.capturedAt),
    resultAsOf: row.resultAsOf ?? null,
    memberCount: row.memberCount,
    memberSeriesIds: (row.memberSeriesIds as string[]) ?? [],
    memberMeta:
      (row.memberMeta as Record<string, { ticker: string; name: string }>) ?? {},
  };
}

function toIso(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : String(d);
}
