import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signIn, signUp } from "./actions";

export const metadata = { title: "Sign in | FundScore.ai" };

interface SignInPageProps {
  searchParams: Promise<{ mode?: string; error?: string }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { mode, error } = await searchParams;
  const isSignup = mode === "signup";

  // Already signed in? Send them to a fund profile.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/funds/FCNTX");

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900">
        {isSignup ? "Create your free account" : "Sign in"}
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        {isSignup
          ? "A free account unlocks the 0–100 Value Offering score and 5-leg breakdown."
          : "Welcome back."}
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      <form className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete={isSignup ? "new-password" : "current-password"}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <button
          formAction={isSignup ? signUp : signIn}
          className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          {isSignup ? "Create account" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        {isSignup ? (
          <>
            Already have an account?{" "}
            <Link href="/signin" className="font-medium text-indigo-600 hover:text-indigo-500">
              Sign in
            </Link>
          </>
        ) : (
          <>
            No account?{" "}
            <Link
              href="/signin?mode=signup"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              Create one free
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
