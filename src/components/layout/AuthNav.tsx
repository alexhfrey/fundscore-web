"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/app/(site)/signin/actions";

const TIER_LABEL: Record<string, string> = {
  free: "Free",
  paid_retail: "Paid",
  pro: "Pro",
};

/**
 * Header auth widget. Client-side so the root layout stays statically
 * renderable — it reads only the user's own session + tier (own-row RLS via the
 * anon key), never gated fund content. Score gating stays server-side in the
 * profile route.
 */
export function AuthNav() {
  const [email, setEmail] = useState<string | null>(null);
  const [tier, setTier] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setEmail(null);
        setTier(null);
        setReady(true);
        return;
      }
      setEmail(user.email ?? null);
      const { data } = await supabase
        .from("entitlements")
        .select("tier")
        .eq("user_id", user.id)
        .maybeSingle();
      setTier(data?.tier ?? "free");
      setReady(true);
    }

    load();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => load());
    return () => subscription.unsubscribe();
  }, []);

  if (!ready) return <div className="h-7 w-20" aria-hidden />;

  if (!email) {
    return (
      <Link
        href="/signin"
        className="rounded-md bg-[#1466b8] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#105399]"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {tier && (
        <span className="hidden sm:inline rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
          {TIER_LABEL[tier] ?? tier}
        </span>
      )}
      <span className="hidden md:inline text-xs text-gray-500">{email}</span>
      <form action={signOut}>
        <button
          type="submit"
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
