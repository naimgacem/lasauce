/**
 * The API and stored media are proxied through Next rather than linked directly
 * at the backend host, so the browser only ever talks to this one origin.
 *
 * Media, specifically: `next/image` optimises **server-side** — the browser asks
 * for `/_next/image?url=…` and the Next server fetches that URL itself. In
 * Docker the Next server cannot reach `localhost:8000` (that's its own
 * container), so a direct API URL 500s even though the browser could load it.
 *
 * Proxying makes both same-origin (`/api/v1/...`, `/media/...`), which means:
 *   - the optimiser fetches over the compose network (`api:8000`),
 *   - no `remotePatterns` allow-list is needed for our own images,
 *   - no CORS preflight, and no CORS_ORIGINS entry per host, and
 *   - **the app works under any hostname without a rebuild** — a LAN IP or a
 *     tunnel URL just works, because nothing baked `localhost` into the bundle.
 *
 * That last point is why `NEXT_PUBLIC_API_URL` should stay relative: it is
 * inlined at BUILD time, so an absolute value pins the bundle to one hostname
 * and every viewer on a different host hits their own machine instead.
 *
 * API_ORIGIN/MEDIA_ORIGIN are RUNTIME server variables (never `NEXT_PUBLIC_*`),
 * so the backend or a storage bucket can move without a rebuild.
 */
import createNextIntlPlugin from "next-intl/plugin";

const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:8000";
const MEDIA_ORIGIN = process.env.MEDIA_ORIGIN ?? "http://localhost:8000";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Hosts allowed to request dev-server internals (/_next/*) cross-origin.
  // Without this the dev server refuses assets and HMR when the app is reached
  // through a tunnel or a LAN IP instead of localhost. Dev-only — `next start`
  // ignores it, so this never widens anything in production.
  allowedDevOrigins: ["*.trycloudflare.com", "*.ngrok-free.app", "192.168.*.*"],
  // Emits a self-contained server bundle (.next/standalone) so the Docker
  // runtime stage ships without node_modules or the build toolchain.
  output: "standalone",

  async rewrites() {
    return [
      { source: "/api/v1/:path*", destination: `${API_ORIGIN}/api/v1/:path*` },
      { source: "/media/:path*", destination: `${MEDIA_ORIGIN}/media/:path*` },
    ];
  },

  images: {
    remotePatterns: [
      // Mock-mode sample photography only. Real item photos are same-origin via
      // the rewrite above and need no entry here.
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
};

export default withNextIntl(nextConfig);
