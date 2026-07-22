# 06 — Frontend Architecture

Next.js 15 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · TanStack Query ·
Zustand · React Hook Form · Zod.

Design goal: a **scalable foundation that can absorb the AI features** (matching,
processing pipeline, notifications) without restructuring — every AI surface has
a reserved seam (types, clients, query keys, UI slots) from day one.

---

## 1. Folder structure

```
src/
├── app/                                # Routing ONLY — thin pages that compose features
│   ├── layout.tsx                      # html/body, fonts, <AppProviders>
│   ├── error.tsx                       # global error boundary
│   ├── not-found.tsx
│   │
│   ├── (public)/                       # Public shell: marketing nav + footer
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # Landing
│   │   ├── lost/page.tsx               # Browse lost items
│   │   ├── found/page.tsx              # Browse found items
│   │   ├── search/page.tsx             # Unified search (type/category/date/keyword)
│   │   └── items/[id]/page.tsx         # Item detail (public; contact gated to auth)
│   │
│   ├── (auth)/                         # Guest-only: centered card shell
│   │   ├── layout.tsx                  # <GuestGuard>
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── reset-password/page.tsx
│   │
│   └── (app)/                          # Authenticated shell: app bar + mobile tab bar
│       ├── layout.tsx                  # <AuthGuard>
│       ├── dashboard/page.tsx
│       ├── my-items/page.tsx
│       ├── report/
│       │   ├── lost/page.tsx           # Create Lost report (wizard)
│       │   └── found/page.tsx          # Create Found report (same wizard, preset type)
│       ├── notifications/page.tsx
│       ├── profile/page.tsx
│       ├── matches/[itemId]/page.tsx   # FUTURE (M5) — route reserved, feature-flagged
│       └── admin/                      # FUTURE — RoleGate(admin), reserved
│
├── components/                         # Domain-agnostic, reusable anywhere
│   ├── ui/                             # shadcn/ui primitives (button, input, card, …)
│   ├── layout/                         # site-header, app-header, mobile-tab-bar, footer
│   ├── feedback/                       # empty-state, error-state, skeletons, spinner
│   └── shared/                         # page-header, pagination, confirm-dialog, stat-card
│
├── features/                           # Feature slices: UI + hooks + schemas per domain
│   ├── auth/
│   │   ├── components/                 # login-form, register-form, …
│   │   ├── guards/                     # auth-guard, guest-guard, role-gate
│   │   ├── hooks/                      # use-session, use-login, use-logout, …
│   │   └── schemas.ts                  # Zod: login, register, reset
│   ├── items/
│   │   ├── components/                 # item-card, item-grid, item-filters, item-detail,
│   │   │                               # status-badge, report-wizard/
│   │   ├── hooks/                      # use-items, use-item, use-create-item, …
│   │   └── schemas.ts                  # Zod: report steps
│   ├── categories/                     # use-categories + category-select (tree-aware)
│   ├── notifications/                  # bell + badge, list, use-notifications, use-unread-count
│   ├── matches/                        # FUTURE-READY: confidence-ring, explanation-chips,
│   │                                   # match-card, use-matches — typed now, shipped at M5
│   └── profile/                        # profile-form, use-update-profile
│
├── services/                           # Data access — NO React imports anywhere here
│   ├── http/
│   │   ├── client.ts                   # typed fetch core: auth header, timeout, error map
│   │   ├── refresh.ts                  # single-flight refresh token rotation
│   │   └── errors.ts                   # ApiError + backend envelope normalisation
│   ├── auth.client.ts
│   ├── items.client.ts
│   ├── categories.client.ts
│   ├── notifications.client.ts
│   ├── matches.client.ts               # typed against api.md; mock-served until M5
│   ├── mock/                           # in-memory adapters, same interfaces as clients
│   └── index.ts                        # barrel: re-exports real or mock per env flag
│
├── hooks/                              # Generic, domain-free hooks
│   ├── use-debounce.ts
│   ├── use-media-query.ts
│   └── use-interval.ts
│
├── store/                              # Zustand — client-owned state only
│   ├── auth.store.ts                   # session: tokens, user snapshot, status (persisted*)
│   ├── ui.store.ts                     # ephemeral chrome: sheets, overlays (NOT persisted)
│   └── draft.store.ts                  # report-wizard autosave (persisted)
│
├── lib/
│   ├── env.ts                          # typed public env (apiUrl, useMocks, flags)
│   ├── routes.ts                       # route constants + access metadata (single source)
│   ├── query-keys.ts                   # query-key factories per domain
│   ├── query-client.ts                 # QueryClient defaults (retry, staleTime)
│   ├── format.ts                       # dates, relative time, confidence %
│   ├── utils.ts                        # cn()
│   └── flags.ts                        # feature flags: matches, admin, notifications
│
├── types/                              # Shared contracts, mirrors backend DTOs
│   ├── api.ts                          # ApiError, Paginated<T>, error envelope
│   ├── auth.ts                         # User, UserRole, AuthResponse
│   ├── item.ts                         # Item, ItemType, ItemStatus, ProcessingStatus, queries
│   ├── category.ts
│   ├── notification.ts                 # Notification, NotificationType, unread count
│   └── match.ts                        # Match, MatchStatus, scores, explanation[]
│
├── providers/
│   ├── app-providers.tsx               # composition root (order: theme → query → auth → toast)
│   ├── query-provider.tsx
│   ├── theme-provider.tsx              # next-themes, class strategy
│   └── auth-provider.tsx               # session bootstrap (silent refresh on load)
│
└── styles/
    └── globals.css                     # Tailwind layers + design tokens (CSS variables)
```

**Rules that keep this scalable**

1. `app/` contains *routing*, not logic — pages compose `features/*`.
2. `features/*` may import `components/`, `services/`, `store/`, `lib/` — never each other's internals (cross-feature via public exports only).
3. `services/` is React-free; `store/` is server-state-free; TanStack Query is the only bridge between them and components.
4. Every future AI surface (matches, admin) exists *today* as types + client + flag — turning them on is additive.

---

## 2. State management strategy

**Litmus test: who owns the data?**
Server owns it → TanStack Query. The session owns it → Zustand. One component owns it → `useState`/RHF.

### TanStack Query — ALL server state
| Data | Notes |
|---|---|
| Items (lists, detail, my-items) | `keepPreviousData` pagination; prefetch detail on card hover |
| Categories | `staleTime: 10min` — near-static |
| Notifications + unread count | unread count polled (45s) while authenticated; optimistic mark-read |
| Matches (M5) | poll while `item.processing_status ∈ {pending, embedding, matching}` |
| Profile (`/auth/me`) | authoritative user; Zustand only keeps a display snapshot |

Conventions: query-key factories in `lib/query-keys.ts`; mutations invalidate via
factories only; errors land in toasts (mutations) or inline error states (queries);
no `useEffect`-driven fetching anywhere.

### Zustand — client/session state (3 small stores)
| Store | Contents | Persisted |
|---|---|---|
| `auth.store` | refresh token, user snapshot, `status: 'loading' \| 'guest' \| 'authed'`; access token **in memory only** | partial |
| `ui.store` | mobile sheet/overlay open-state, active search overlay | no |
| `draft.store` | report-wizard draft (autosave so a refresh never loses a report) | yes |

### Local state — everything else
RHF owns all form fields; wizard step index, hover/disclosure toggles stay in
components. If two distant components need it → promote to `ui.store`. If the
server could ever disagree with it → it was never client state.

---

## 3. API architecture

Layered: **http core → domain clients → query hooks → components.**

### `services/http/client.ts` — typed fetch core
- Base URL from `env.apiUrl` (`/api/v1`), JSON in/out, `AbortController` timeout (12s).
- Injects `Authorization: Bearer <access>` when a session exists.
- Maps the backend envelope `{ error: { code, message, details } }` → `ApiError { code, message, status, details }`. Network failures → `ApiError('NETWORK_ERROR')`.
- On `401`: delegates to `refresh.ts` — **single-flight** (one refresh no matter how many parallel 401s), replays the original request once, on refresh failure clears session → `/login?next=<path>`.

### Domain clients — pure typed functions
```ts
// auth.client.ts
register(data): Promise<AuthResponse>      login(data): Promise<AuthResponse>
refresh(token): Promise<AuthResponse>      logout(refreshToken): Promise<void>
me(): Promise<User>                        updateMe(patch): Promise<User>
forgotPassword(email) · resetPassword(token, pw) · verifyEmail(token)

// items.client.ts
list(query: ItemQuery): Promise<Paginated<Item>>      // type, status, category_id,
get(id): Promise<Item>                                 // date_from/to, user_id, page…
create(payload): Promise<Item>           update(id, patch): Promise<Item>
withdraw(id): Promise<void>              resolve(id): Promise<Item>   // → closed/recovered

// categories.client.ts
tree(): Promise<Category[]>

// notifications.client.ts
list(query): Promise<Paginated<Notification>>   unreadCount(): Promise<{count}>
markRead(id) · markAllRead()

// matches.client.ts  (typed from api.md — mock-served until M5)
forItem(itemId): Promise<MatchSuggestions>      get(id): Promise<Match>
confirm(id) · reject(id) · feedback(id, {is_correct, comment})
```

### Mock adapters
`services/mock/*` implement the *same interfaces* over an in-memory dataset
(items lifecycle, unread counts, fake match suggestions with confidence scores).
`services/index.ts` switches on `NEXT_PUBLIC_USE_MOCKS` — components and hooks
never know which side they're on. This keeps the app fully demoable with the
backend down, and lets us build the M5 match UI before the engine exists.

**Contract note:** DTOs are typed to the **implemented** backend
(`lost_or_found_at`, `latitude`/`longitude`, paginated envelope with
`total_pages`), not the older field names in api.md.

---

## 4. Authentication architecture

### Token handling
- **Access token (15 min): memory only** — never written to storage; XSS can't lift it from localStorage.
- **Refresh token (30 d, rotating): persisted** via the auth store. Accepted MVP trade-off, isolated behind the store so a move to httpOnly cookies later touches one file. Backend already does rotation + reuse detection.

### Session lifecycle
```
App load → AuthProvider bootstrap
  ├─ no refresh token            → status: guest
  └─ refresh token found         → POST /auth/refresh (silent)
       ├─ ok    → store new pair (rotation) → status: authed
       └─ fail  → clear → status: guest

Mid-session 401 → single-flight refresh → replay original request
  └─ refresh fails → clear session → /login?next=<current-path>

Logout → POST /auth/logout (revokes refresh) → clear store + query cache → /login
```
Guards render skeletons while `status === 'loading'` — protected content never flashes.

### Protected routes & RBAC
- Layout-level guards per route group: `(app)` → `<AuthGuard>`, `(auth)` → `<GuestGuard>`; public group has none.
- `<RoleGate roles={['admin']}>` for admin surfaces (route group reserved).
- `lib/routes.ts` is the single source of paths + access metadata — nav menus and guards derive from it, so a new page can't forget its protection.
- Ownership mirrors the backend policy: `can.editItem(user, item)` = owner or admin — UI hides owner-only controls, backend remains the enforcer.

---

## 5. Responsive design system

### Typography scale (Geist Sans; mobile → desktop)
| Token | Size | Use |
|---|---|---|
| `display` | 36 → 56px · bold · tight | Landing hero only |
| `h1` | 30 → 36px · semibold | Page titles |
| `h2` | 24px · semibold | Section titles |
| `h3` | 20px · semibold | Card titles |
| `h4` | 18px · medium | Sub-headers |
| `body` | 16px · leading-7 | Default |
| `body-sm` | 14px | Secondary, metadata |
| `caption` | 12px · medium · wide tracking | Timestamps, labels, badges |

### Spacing scale (4px base, semantic aliases)
`inline` 8 · `stack-sm` 12 · `stack` 16 · `stack-lg` 24 · `block` 32 ·
`section` 48 (mobile) / 80 (desktop) · card padding 20–24 · page gutter 16 (mobile) / 24 (desktop).

### Layout containers
| Container | Max width | Use |
|---|---|---|
| `container-page` | 80rem (7xl) | Landing, browse grids |
| `container-app` | 64rem (5xl) | Dashboard, my-items, notifications |
| `container-prose` | 42rem (2xl) | Item detail text, wizard |
| `container-form` | 28rem (md) | Auth cards |

### Breakpoints (Tailwind defaults, mobile-first)
| Bp | ≥px | What changes |
|---|---|---|
| base | 0 | 1-col cards; filters in bottom sheet; **bottom tab bar** in (app) |
| `sm` | 640 | 2-col card grids |
| `md` | 768 | Inline filter bar; 2-col detail |
| `lg` | 1024 | Desktop shell: full top nav, tab bar hides; 3-col grids |
| `xl` | 1280 | Wider gutters; dashboard 2-col (main + activity rail) |

Hard rules: no data tables in user-facing UI (card lists always); touch targets ≥ 44px; every interactive state has a visible focus ring.

---

## 6. UI/UX — application structure

### Navigation model
- **Public shell:** top nav `[◈ Logo] Lost · Found · Search · [theme] [Sign in] [Report item →]` + footer. Report CTA deep-links into auth with `?next=`.
- **App shell (desktop ≥lg):** top bar `[◈] Dashboard · Browse · My Items · [Report ▾] · [🔔•] [avatar]`.
- **App shell (mobile):** slim top bar + **bottom tab bar**: `Home · Browse · ⊕ Report (raised) · Alerts · Profile`.

### Page map
| Area | Route | Content |
|---|---|---|
| Landing | `/` | Hero + search-first CTA, how-it-works (3 steps), recent items strip, trust stats |
| Browse Lost / Found | `/lost` `/found` | Same browse surface, preset type; filters + card grid + pagination |
| Search | `/search` | Unified: keyword + all filters, URL-driven (shareable) |
| Item detail | `/items/[id]` | Gallery slot, facts, status; contact gated to auth; owner actions; **AI match panel slot** |
| Dashboard | `/dashboard` | Greeting, your-items status strip (with processing indicator), recent matches placeholder, activity preview |
| My Items | `/my-items` | Tabs: Lost · Found · Closed; status pills, quick actions |
| Report Lost/Found | `/report/lost` `/report/found` | One wizard, two entries: ① What (type/title/category/desc/photos-later) ② Where & when → review; draft autosave |
| Notifications | `/notifications` | Grouped by day, unread dots, mark-all-read |
| Profile | `/profile` | Identity card, profile form, security (password), sessions note |
| Matches *(future)* | `/matches/[itemId]` | Ranked suggestions: confidence ring, explanation chips, confirm/reject |
| Admin *(future)* | `/admin` | Stats, moderation — RoleGate |

---

## 7. Design language — “calm utility, with a spark”

**Feel:** a public service you instantly trust, with clearly-marked moments of
intelligence. Think modern civic app, not SaaS dashboard.

- **Canvas first:** warm near-white (stone) light mode; rich near-black dark mode. Hierarchy comes from type + space, not boxes. Cards: `rounded-2xl`, hairline border, `shadow-sm`.
- **One accent:** deep **indigo** for actions and focus. Semantic colors are reserved for meaning only: **Lost = rose**, **Found = emerald**, **processing = amber**.
- **The AI signature:** an **indigo→violet gradient + sparkle glyph used *exclusively* for AI surfaces** — match confidence rings, processing states, suggestion cards. AI feels present and legible precisely because the rest of the UI never uses gradients.
- **Motion:** 150–200ms ease-out, skeletons over spinners, list items fade-slide in; the confidence ring animates once on reveal. Nothing loops, nothing bounces.
- **Trust cues:** plain-language status (“Waiting for matches” not `PENDING`), relative + absolute time, owner-only controls invisible to others, a “how matching works” link wherever AI output appears.
- **Anti-corporate guardrails:** no persistent sidebar in user space, no dense tables, no KPI-wall dashboards — the dashboard reads like a personal feed, not analytics.

---

## 8. Wireframes (text)

### Landing `/`
```
┌──────────────────────────────────────────────────────────────┐
│ ◈ Lost&Found      Lost  Found  Search        ◐  Sign in  [Report item] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│        Lost something? Found something?                      │
│        Our AI helps reunite people with their things.        │
│                                                              │
│        ┌────────────────────────────────────┐  [Report ✦]   │
│        │ 🔍  Search items… “black wallet”   │                │
│        └────────────────────────────────────┘                │
│   ───────────────────────────────────────────────────────   │
│    ① Report it      ② AI looks for matches   ③ Reunite      │
│      2-min form        you get notified         confirm &    │
│                                                  recover      │
│   ───────────────────────────────────────────────────────   │
│   Recently reported                                 See all →│
│   [card] [card] [card] [card]                                │
│   ───────────────────────────────────────────────────────   │
│   ◈ 1,2k items reported · 480 reunited · avg 36h to match    │
└──────────────────────────────────────────────────────────────┘
```

### Browse `/lost` (desktop ≥md; mobile: filters → bottom sheet)
```
┌──────────────────────────────────────────────────────────────┐
│ Lost items                                  [Report lost ✦]  │
│ ┌Type──┐ ┌Category──┐ ┌From──┐ ┌To──┐ ┌Status─┐  ✕ Clear     │
├──────────────────────────────────────────────────────────────┤
│ ┌────────────┐ ┌────────────┐ ┌────────────┐                 │
│ │ ▓ img      │ │ ▓ img      │ │ ▓ img      │                 │
│ │ LOST ·Open │ │ LOST ·Open │ │ LOST ·Match│                 │
│ │ Black wal… │ │ iPhone 14… │ │ Keys, red… │                 │
│ │ ⌖ Library  │ │ ⌖ Bus 12   │ │ ⌖ Eng. bldg│                 │
│ │ ◷ 2 d ago  │ │ ◷ 1 d ago  │ │ ◷ 5 d ago  │                 │
│ └────────────┘ └────────────┘ └────────────┘                 │
│              ‹ Prev   Page 1 / 4   Next ›                    │
└──────────────────────────────────────────────────────────────┘
```

### Item detail `/items/[id]`
```
┌──────────────────────────────────────────────────────────────┐
│ ← Back                                    (owner: [Edit] [Withdraw]) │
│ ┌───────────────┐   LOST · Open                              │
│ │               │   Black leather wallet                     │
│ │   gallery     │   ⌖ Central Library, Main St               │
│ │  (slot, M4)   │   ◷ Lost Jun 9 · posted 2 d ago            │
│ │               │   ⊞ Wallets & Purses  · ◑ black · Fossil   │
│ └───────────────┘                                            │
│ Bifold wallet with ID and two bank cards…                    │
│ ┌─ ✦ AI matching ────────────────────────────────────────┐   │
│ │ ✦ Looking for matches… (amber pulse)   How it works ↗  │   │
│ │ [reserved: match suggestion cards — M5]                │   │
│ └────────────────────────────────────────────────────────┘   │
│ [🔒 Sign in to contact the reporter]                          │
└──────────────────────────────────────────────────────────────┘
```

### Dashboard `/dashboard`
```
┌──────────────────────────────────────────────────────────────┐
│ Good evening, Naim                       [Report lost] [Report found] │
│                                                              │
│ Your items                                                   │
│ ┌──────────────────────┐ ┌──────────────────────┐            │
│ │ Black wallet  LOST   │ │ Blue backpack FOUND  │            │
│ │ ✦ matching…  (amber) │ │ ● 2 suggestions ✦    │            │
│ └──────────────────────┘ └──────────────────────┘            │
│                                                              │
│ Activity                                          See all →  │
│ • ✦ New possible match for “Black wallet”        2h ago      │
│ • Your report “Blue backpack” is now visible     1d ago      │
│                                                              │
│ Community                                                    │
│ [recent items strip ────────────────────────────]            │
└──────────────────────────────────────────────────────────────┘
```

### Report wizard `/report/lost` (container-prose)
```
┌────────────────────────────────────────────┐
│ Report a lost item            ● ● ○  2/3   │
│                                            │
│ Step 2 — Where & when                      │
│ Location   [ Central Library, Main St    ] │
│ Date lost  [ 2026-06-09 ▾ ]                │
│                                            │
│ ┌ summary (sticky) ───────────────┐        │
│ │ Black leather wallet · Wallets  │        │
│ └─────────────────────────────────┘        │
│ Draft saved ✓        [← Back]  [Continue →]│
└────────────────────────────────────────────┘
```

### Notifications `/notifications`
```
┌────────────────────────────────────┐
│ Notifications        [Mark all read]│
│ Today                              │
│ ● ✦ Possible match found    2h     │
│ ● Item visible to community 6h     │
│ Yesterday                          │
│ ○ Welcome to Lost & Found   1d     │
└────────────────────────────────────┘
```

### Mobile app shell (any (app) page, <lg)
```
┌──────────────────────┐
│ ◈            🔔•  ☰  │
│ ┌──────────────────┐ │
│ │   page content   │ │
│ │   (1-col cards)  │ │
│ └──────────────────┘ │
├──────────────────────┤
│  ⌂      ⌕     ⊕✦     🔔     ◯  │
│ Home  Browse Report Alerts You │
└──────────────────────┘
```

---

## Build order after approval

1. Foundation: config, tokens, providers, http core + clients + mocks, stores, guards.
2. Core layout system: public shell, auth shell, app shell (top bar + mobile tab bar), feedback components.
3. *(Stop — business pages are a separate step per scope.)*
