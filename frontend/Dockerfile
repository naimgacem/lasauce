# syntax=docker/dockerfile:1

# ---- deps: install from the lockfile only, for maximum layer caching ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* values are inlined into the client bundle at BUILD time, so they
# must arrive as build args — setting them at runtime would have no effect.
ARG NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
# Empty on purpose: item photos stay same-origin and resolve through the
# `/media/*` rewrite, which is what lets next/image optimise them in Docker.
ARG NEXT_PUBLIC_MEDIA_URL=
ARG NEXT_PUBLIC_USE_MOCKS=false
# `rewrites()` is serialised into .next/routes-manifest.json during the build,
# so the media proxy target has to be known HERE — a runtime env var arrives
# too late and the baked-in default would win.
ARG MEDIA_ORIGIN=http://localhost:8000
# Needed at build time too: statically prerendered pages evaluate their exported
# `metadata` (and therefore `metadataBase`) during the build, so canonical and
# Open Graph URLs are frozen here. It is ALSO passed at runtime, for the
# `generateMetadata` on dynamic routes like /items/[id].
ARG SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_MEDIA_URL=$NEXT_PUBLIC_MEDIA_URL \
    NEXT_PUBLIC_USE_MOCKS=$NEXT_PUBLIC_USE_MOCKS \
    MEDIA_ORIGIN=$MEDIA_ORIGIN \
    SITE_URL=$SITE_URL \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---- runner: standalone output only, no node_modules, no toolchain ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# `standalone` contains server.js + the minimal traced dependency set.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
