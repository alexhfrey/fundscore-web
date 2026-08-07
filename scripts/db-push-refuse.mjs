#!/usr/bin/env node
// `npm run db:push` entry point — prints the same refusal the drizzle.config.ts
// guard raises, so both paths carry one message from one source
// (scripts/db-push-guard.cjs). ESM importing that CJS module works on Node 20+.
import guard from "./db-push-guard.cjs";

console.error(guard.MESSAGE);
process.exit(1);
