import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // The cities directory moved /labs → /local-labs (July 2026); old
    // links and bookmarks follow permanently.
    return [
      { source: "/labs", destination: "/local-labs", permanent: true },
      {
        source: "/labs/:slug",
        destination: "/local-labs/:slug",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
