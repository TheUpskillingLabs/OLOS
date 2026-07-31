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
      // The team page was trimmed to the board and moved /team → /board
      // (July 2026); old links follow permanently.
      { source: "/team", destination: "/board", permanent: true },
      // The Frame Sprint became the public AU co-hosted hackathon and took a
      // new slug with it (migration 00092); shared links keep working.
      {
        source: "/events/hackathon-frame-sprint",
        destination: "/events/civics-elections-hackathon",
        permanent: true,
      },
      // The Luma-synced twin was prod's public hackathon URL for weeks
      // before it was merged into the anchor row (2026-07-30 repair);
      // shared links keep working.
      {
        source: "/events/idea-to-prototype-a-civics-and-elections-hackathon",
        destination: "/events/civics-elections-hackathon",
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
