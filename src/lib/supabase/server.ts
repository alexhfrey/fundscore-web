import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client (RSC, server actions, route handlers).
 * Reads/writes the auth cookies via Next's async cookie store. In a pure RSC
 * render the cookie store is read-only, so writes are wrapped in try/catch —
 * the middleware is responsible for refreshing the session cookie.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component render — safe to ignore; the
            // middleware refreshes the session cookie on the next request.
          }
        },
      },
    },
  );
}
