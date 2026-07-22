# Lost & Found — Web

Next.js 15 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · TanStack Query ·
Zustand · React Hook Form · Zod.

Full architecture: [`docs/frontend-architecture.md`](../docs/frontend-architecture.md).

## Getting started

```bash
npm install
cp .env.local.example .env.local   # defaults to mock mode
npm run dev                         # http://localhost:3000
```

`NEXT_PUBLIC_USE_MOCKS=true` (default) serves an in-memory dataset — the whole
app is demoable without a backend. On the sign-in page, use **“Continue with
demo account”**. Set the flag to `false` plus `NEXT_PUBLIC_API_URL` to hit the
real FastAPI backend.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` / `build` / `start` | Dev server / production build / serve |
| `npm run lint` / `typecheck` | ESLint / `tsc --noEmit` |

## What exists today (foundation + layout system)

- **Three shells:** `(public)` marketing header + footer · `(auth)` centered
  card + GuestGuard · `(app)` AuthGuard + app header + **mobile bottom tab bar**.
- **Auth core:** access token in memory, persisted rotating refresh token,
  silent-refresh bootstrap, single-flight 401 refresh, role gate.
- **Data layer:** typed fetch core → 5 domain clients (auth, items, categories,
  notifications, matches) with mock adapters behind one `api` barrel.
- **Design tokens:** stone canvas, indigo accent, semantic lost/found/processing
  colors, AI-only gradient (`.bg-ai-gradient`, `Badge variant="ai"`).
- Business pages (browse, wizard, notifications UI, profile) are intentionally
  stubs — they ship next. AI matching ships at M5 against `services/matches`.
