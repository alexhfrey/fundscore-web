import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated local state from `npx supabase start` (gitignored via
    // supabase/.gitignore). It contains a vendored, minified edge-runtime
    // bundle, which makes `npm run lint` fail with ~150 errors on any machine
    // that has run local Supabase — a red build gate that says nothing about
    // this repo's source.
    "supabase/.temp/**",
  ]),
]);

export default eslintConfig;
