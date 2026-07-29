/**
 * Media is proxied through Next rather than linked directly at the API host.
 *
 * Why: `next/image` optimises **server-side** — the browser asks for
 * `/_next/image?url=…` and the Next server fetches that URL itself. In Docker
 * the Next server cannot reach `localhost:8000` (that's its own container), so
 * a direct API URL 500s even though the browser could load it fine.
 *
 * Proxying makes item photos same-origin (`/media/...`), which means:
 *   - the optimiser fetches over the compose network (`api:8000`), and
 *   - no `remotePatterns` allow-list is needed for our own images.
 *
 * MEDIA_ORIGIN is a RUNTIME server variable (never `NEXT_PUBLIC_*`) so the same
 * image can be rebuilt-free-swapped to an S3/R2 bucket in production.
 */
const MEDIA_ORIGIN = process.env.MEDIA_ORIGIN ?? "http://localhost:8000";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emits a self-contained server bundle (.next/standalone) so the Docker
  // runtime stage ships without node_modules or the build toolchain.
  output: "standalone",

  async rewrites() {
    return [{ source: "/media/:path*", destination: `${MEDIA_ORIGIN}/media/:path*` }];
  },

  images: {
    remotePatterns: [
      // Mock-mode sample photography only. Real item photos are same-origin via
      // the rewrite above and need no entry here.
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
};

export default nextConfig;
