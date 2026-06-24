import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // DuckDB ships a native addon; keep it external so Next doesn't try to bundle
  // the .node binary into the server build (serving_architecture Decision 6:
  // the screener path runs DuckDB-on-Parquet in the Node runtime, never bundled).
  serverExternalPackages: ["@duckdb/node-api", "@duckdb/node-bindings"],
};

export default nextConfig;
