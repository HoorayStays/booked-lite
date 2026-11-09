import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // @libsql/client ships native bits for local SQLite files; keep it out of the bundle.
  serverExternalPackages: ["@libsql/client", "libsql"],
};

export default nextConfig;
