import type { Instrumentation } from "next";

/**
 * Server-side error capture for the beta.
 *
 * Next calls `onRequestError` for every uncaught server error — RSC renders,
 * server actions and route handlers alike. This is the whole server half of
 * the beta's error tracking; the client half is the error boundaries reporting
 * through /api/ops.
 *
 * Runtime guard: the proxy (src/proxy.ts) runs on the Edge runtime, where
 * postgres.js has no TCP socket to open. Importing the sink there would break
 * the build, so the durable path is loaded lazily and only under Node. Edge
 * errors still reach stderr, which Vercel captures.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  // Next types the digest as an optional property on the error object.
  const digest =
    typeof err === "object" && err !== null && "digest" in err
      ? String((err as { digest?: unknown }).digest ?? "")
      : undefined;

  if (process.env.NEXT_RUNTIME !== "nodejs") {
    console.error(
      `[ops:error] ${JSON.stringify({
        source: "server",
        runtime: process.env.NEXT_RUNTIME ?? "unknown",
        route: request.path,
        message,
      })}`,
    );
    return;
  }

  const headers = request.headers as Record<string, string | undefined>;
  const { recordServerError } = await import("@/lib/observability/record-error");

  await recordServerError({
    source: "server",
    // `context.routePath` is the matched route pattern (/funds/[ticker]);
    // request.path is what the user actually hit. The concrete path is what
    // you need to reproduce a beta user's crash.
    route: request.path,
    digest,
    message: `${message} [${context.routerKind}/${context.routeType}]`,
    stack,
    userAgent: headers["user-agent"],
  });
};
