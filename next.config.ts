import type { NextConfig } from "next";

const noFraming = [{ key: "Content-Security-Policy", value: "frame-ancestors 'none'" }, { key: "X-Frame-Options", value: "DENY" }];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // @libsql/client ships native bits for local SQLite files; keep it out of the bundle.
  serverExternalPackages: ["@libsql/client", "libsql"],
  async headers() {
    return [
      // Public booking pages may be embedded in any website (that's the embed widget).
      // The admin area and sign-in pages may not.
      { source: "/admin/:path*", headers: noFraming },
      { source: "/admin", headers: noFraming },
      { source: "/login/:path*", headers: noFraming },
      { source: "/login", headers: noFraming },
      { source: "/invite/:path*", headers: noFraming },
      { source: "/embed.js", headers: [{ key: "Cache-Control", value: "public, max-age=3600" }] },
    ];
  },
};

export default nextConfig;
