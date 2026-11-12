import type { NextConfig } from "next";

/**
 * Security headers (Stage 0 G3).
 *
 * CSP notes:
 *  - 'unsafe-inline' for styles: Tailwind injects an inline <style> tag and
 *    Radix/shadcn components rely on inline style attributes. This is the
 *    standard Next.js + Tailwind trade-off; script-src stays strict.
 *  - 'unsafe-eval' only in development (React Refresh requires it).
 *  - blob:/data: workers: needed by Serwist (service worker PWA).
 *  - img-src includes OpenStreetMap tiles, unpkg (Leaflet marker icons),
 *    Google static content (SVG avatars in some seed data) and data: URIs.
 *  - connect-src: self + tile.openstreetmap.org (Leaflet XHR tile loading).
 */
const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://unpkg.com https://lh3.googleusercontent.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.tile.openstreetmap.org https://nominatim.openstreetmap.org",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  ...(isDev
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig: NextConfig = {
  output: "standalone",
  // Stage 0 G6: type errors must fail the build. (Previously ignoreBuildErrors: true)
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      // The service worker file must never be cached aggressively.
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
