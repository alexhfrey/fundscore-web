"use client";

// ============================================================================
// CrescentMark — verbatim canvas port of drawMoon / drawMoonAnatomy from the
// design source of truth:
//   fund_score/docs/product/strategy/mockup_fund_profile_crescent.html
//   (drawMoon ~L625-657, drawMoonAnatomy ~L661-683)
//
// Geometry is ported exactly, including the `f<0.5` anticlockwise flag on the
// terminator ellipse — that flag is what makes the gold area equal f·πR²
// (verified analytically; see the Step 2 verification script). The mockup's
// own inline comment (L649-651) notes it fixed an inverted (paints 1−f)
// version of this same mark on 2026-07-19 — do not "simplify" this flag away.
//
// Palette: the mockup special-cases a `data-pal="blue"` canvas attribute to
// pick an alternate accent pair for its Variant B. This port doesn't need
// that — the `--crescent-*` tokens in globals.css already swap value per
// `data-accent`/`data-theme` on <html> (Step 1), so reading the tokens at
// draw time is sufficient; the MutationObserver below re-draws when those
// attributes change.
// ============================================================================

import { useEffect, useRef } from "react";

export type CrescentVariant = "hero" | "anatomy";

export interface CrescentMarkProps {
  /** Gold-fill fraction in [0,1]; null renders the grey twin disc + limb ring only (locked/unscored state) — no gold. */
  fill: number | null;
  /** Hatch fraction in [0,1] (anatomy variant only); ignored by the hero variant. */
  fhatch?: number | null;
  /** Rotation in degrees, applied to the whole mark about its own center. */
  orientDeg?: number;
  /** CSS pixel size — the mark is always square (size × size). */
  size: number;
  ariaLabel: string;
  /** "hero" (default): solid gold moon phase. "anatomy": + 45° hatch overlay at fhatch. */
  variant?: CrescentVariant;
}

/** Reads a `--crescent-*` custom property off the document root at draw time — never hardcode hex. */
function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Verbatim port of drawMoon (mockup L625-657), minus the DOM/attribute
 * plumbing (canvas sizing + rotate/transform setup happen in the effect
 * below; this draws into an already-scaled, already-cleared, already-rotated
 * context).
 */
function paintMoon(ctx: CanvasRenderingContext2D, size: number, f: number | null) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - Math.max(3, size * 0.045);
  const twin = cssVar("--crescent-twin");
  const edge = cssVar("--crescent-twin-edge");
  const gold = cssVar("--crescent-accent");
  const goldBright = cssVar("--crescent-accent-bright");

  // grey twin disc
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = twin;
  ctx.fill();

  // gold illuminated region (lit on the right), area == f * pi * R^2
  const fClamped = f == null ? null : Math.max(0, Math.min(1, f));
  if (fClamped != null && fClamped > 0.001) {
    const a = R * (2 * fClamped - 1);
    const ax = Math.abs(a);
    const gradient = ctx.createLinearGradient(cx, cy - R, cx + R, cy + R);
    gradient.addColorStop(0, goldBright);
    gradient.addColorStop(1, gold);
    ctx.beginPath();
    ctx.arc(cx, cy, R, -Math.PI / 2, Math.PI / 2, false); // right limb, top -> bottom
    // terminator back to top; f<0.5 makes gold area exactly f*pi*R^2 (an
    // f>=0.5 anticlockwise flag here would paint gold = 1-f, an inverted mark)
    ctx.ellipse(cx, cy, ax, R, 0, Math.PI / 2, -Math.PI / 2, fClamped < 0.5);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  // limb ring
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.strokeStyle = edge;
  ctx.lineWidth = Math.max(1, size * 0.008);
  ctx.stroke();
}

/**
 * Verbatim port of drawMoonAnatomy (mockup L661-683): the base mark, plus 45°
 * hatch lines clipped to the SAME moon-phase shape evaluated at fh (the
 * nameable/factor share of the gold fill), rather than the full gold area.
 */
function paintMoonAnatomy(ctx: CanvasRenderingContext2D, size: number, f: number | null, fh: number | null) {
  paintMoon(ctx, size, f);

  const fhClamped = Math.max(0, Math.min(1, fh || 0));
  if (fhClamped <= 0.001) return;

  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - Math.max(3, size * 0.045);
  const edge = cssVar("--crescent-twin-edge");

  ctx.save();
  const a = R * (2 * fhClamped - 1);
  const ax = Math.abs(a);
  ctx.beginPath();
  ctx.arc(cx, cy, R, -Math.PI / 2, Math.PI / 2, false);
  ctx.ellipse(cx, cy, ax, R, 0, Math.PI / 2, -Math.PI / 2, fhClamped < 0.5);
  ctx.closePath();
  ctx.clip();

  ctx.strokeStyle = edge;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1;
  for (let d = -size; d <= size * 2; d += 5) {
    ctx.beginPath();
    ctx.moveTo(d, 0);
    ctx.lineTo(d + size, size);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * The Crescent mark — a canvas rendering of the gold-fill/grey-twin disc.
 * Static (no animation); redraws on mount, on window resize (rAF-debounced),
 * whenever `document.documentElement`'s `data-accent`/`data-theme` attributes
 * change (palette/theme swap), and whenever props change. Server-safe: touches
 * `window`/`document` only inside effects, never at module scope or render.
 */
export function CrescentMark({
  fill,
  fhatch = null,
  orientDeg = 0,
  size,
  ariaLabel,
  variant = "hero",
}: CrescentMarkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function draw() {
      if (!canvas) return;
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      const cx = size / 2;
      const cy = size / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(((orientDeg || 0) * Math.PI) / 180);
      ctx.translate(-cx, -cy);
      if (variant === "anatomy") {
        paintMoonAnatomy(ctx, size, fill, fhatch);
      } else {
        paintMoon(ctx, size, fill);
      }
      ctx.restore();
    }

    draw();

    let rafId: number | null = null;
    function onResize() {
      if (rafId != null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        draw();
      });
    }
    window.addEventListener("resize", onResize);

    const observer = new MutationObserver((mutations) => {
      const relevant = mutations.some(
        (m) =>
          m.type === "attributes" &&
          (m.attributeName === "data-accent" || m.attributeName === "data-theme"),
      );
      if (relevant) draw();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-accent", "data-theme"],
    });

    return () => {
      window.removeEventListener("resize", onResize);
      if (rafId != null) cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [fill, fhatch, orientDeg, size, variant]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={ariaLabel}
      width={size}
      height={size}
      style={{ width: size, height: size, display: "block" }}
    />
  );
}
