import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ============================================================================
// PRE-LAUNCH GATE
//
// The product is not public yet. Everything except the landing page, the
// methodology page and sign-in is closed — visitors get the landing page and a
// signup, nothing else.
//
// Being SIGNED IN is deliberately not enough. Supabase signup is self-serve, so
// "gated to logged-in users" would in practice mean "gated to anyone willing to
// spend ten seconds creating an account". A user reaches the product only if
// their email is on the `early_access` allowlist. Granting access is one INSERT
// (scripts/grant-early-access.mjs) — which is exactly the "opening in stages"
// flow the landing page promises.
//
// To open the site publicly: set LAUNCHED=true (or delete this block).
// ============================================================================

const LAUNCHED = process.env.LAUNCHED === "true";

/** Paths an anonymous visitor may reach. Everything else redirects to "/". */
const PUBLIC_PATHS = [
  "/", // the landing page (server actions also POST here)
  "/methodology", // deliberately public trust surface — see methodology/page.tsx
  "/signin",
];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  // Supabase auth callbacks + Next internals.
  if (pathname.startsWith("/auth/")) return true;
  if (pathname.startsWith("/_next/")) return true;
  return false;
}

/**
 * Refresh the Supabase session on every request and sync the auth cookies onto
 * the response. Must run for all non-static routes (see src/proxy.ts) so server
 * components downstream see a valid session. Do not run logic between
 * createServerClient and getUser (per Supabase SSR guidance).
 *
 * Then apply the pre-launch gate.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Signed in ≠ allowed in. Ask the allowlist. RLS lets a user read only their
  // own row, so this returns their grant or nothing — it can never enumerate.
  // Queried through supabase-js (fetch-based) rather than postgres.js on
  // purpose: proxy/middleware runs on the Edge runtime, where a raw TCP driver
  // does not exist.
  let allowed = false;
  if (!LAUNCHED && user?.email && !isPublic(pathname)) {
    const { data: grant } = await supabase
      .from("early_access")
      .select("email")
      .ilike("email", user.email)
      .maybeSingle();
    allowed = Boolean(grant);
  }

  if (!LAUNCHED && !allowed && !isPublic(pathname)) {
    // API routes get a status code, not a redirect. This is not cosmetic:
    // /api/portfolio/solve runs a ~170s CVXPY solve, so leaving it reachable by
    // an anonymous POST while the pages around it are gated would be an open
    // door to an expensive endpoint. Gate by PATH, never by method.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "FundScore isn't open yet." },
        { status: 401 },
      );
    }

    // Documents redirect to the landing page. Anything else (a POST to a gated
    // page — i.e. a server action on a page an anonymous user cannot even load)
    // is refused outright rather than 307'd, since following a redirect would
    // silently re-run the action against "/".
    if (request.method === "GET") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return new NextResponse(null, { status: 401 });
  }

  return response;
}
