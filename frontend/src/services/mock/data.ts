import type { User } from "@/types/auth";
import type { CreditPack, Entitlements } from "@/types/billing";
import type { Category, CategorySummary } from "@/types/category";
import type { Item } from "@/types/item";
import type { MatchSuggestions } from "@/types/match";
import type { AppNotification } from "@/types/notification";

export const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));
export const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString();

export const MOCK_USER: User = {
  id: "u-demo-0001",
  email: "demo@lostfound.app",
  full_name: "Demo User",
  phone: null,
  role: "user",
  status: "active",
  avatar_url: null,
  is_verified: true,
  created_at: daysAgo(120),
};

const summary = (c: Category): CategorySummary => ({
  id: c.id,
  name: c.name,
  slug: c.slug,
});

export const MOCK_CATEGORIES: Category[] = [
  {
    id: "c-electronics",
    name: "Electronics",
    slug: "electronics",
    parent_id: null,
    children: [
      { id: "c-phones", name: "Phones", slug: "phones", parent_id: "c-electronics", children: [] },
      { id: "c-laptops", name: "Laptops & Tablets", slug: "laptops-tablets", parent_id: "c-electronics", children: [] },
    ],
  },
  { id: "c-wallets", name: "Wallets & Purses", slug: "wallets-purses", parent_id: null, children: [] },
  { id: "c-keys", name: "Keys", slug: "keys", parent_id: null, children: [] },
  { id: "c-bags", name: "Bags & Luggage", slug: "bags-luggage", parent_id: null, children: [] },
  { id: "c-other", name: "Other", slug: "other", parent_id: null, children: [] },
];

export function findCategory(id: string | null | undefined): CategorySummary | null {
  if (!id) return null;
  for (const root of MOCK_CATEGORIES) {
    if (root.id === id) return summary(root);
    const child = root.children.find((c) => c.id === id);
    if (child) return summary(child);
  }
  return null;
}

/** Demo imagery (mock mode only). `image_path` is a URL here; the real
 *  backend serves storage keys resolved by the media endpoint. */
function demoImages(itemId: string, seeds: string[]) {
  return seeds.map((seed, i) => ({
    id: `${itemId}-img-${i}`,
    item_id: itemId,
    image_path: `https://picsum.photos/seed/${seed}/800/600`,
    created_at: daysAgo(1),
  }));
}

function item(partial: Partial<Item> & Pick<Item, "id" | "type" | "title">): Item {
  return {
    user_id: MOCK_USER.id,
    status: "open",
    processing_status: "ready",
    description: "",
    category_id: null,
    category: null,
    color: null,
    brand: null,
    location_text: null,
    wilaya_code: 16,
    claim_questions: [],
    latitude: null,
    longitude: null,
    lost_or_found_at: daysAgo(3),
    closed_reason: null,
    closed_at: null,
    images: [],
    created_at: daysAgo(3),
    updated_at: daysAgo(3),
    ...partial,
  };
}

export const MOCK_ITEMS: Item[] = [
  item({
    id: "i-wallet",
    type: "lost",
    title: "Black leather wallet",
    description:
      "Bifold wallet with ID and two bank cards. Lost near the central library entrance.",
    category_id: "c-wallets",
    category: findCategory("c-wallets"),
    color: "black",
    brand: "Fossil",
    location_text: "Central Library, Main St",
    wilaya_code: 16,
    processing_status: "matching",
    images: demoImages("i-wallet", ["lf-wallet-a", "lf-wallet-b"]),
    lost_or_found_at: daysAgo(2),
    created_at: daysAgo(2),
  }),
  item({
    id: "i-iphone",
    type: "found",
    title: "iPhone 14 Pro, deep purple",
    description: "Found a locked iPhone on the number 12 bus. Cracked screen protector.",
    category_id: "c-phones",
    category: findCategory("c-phones"),
    color: "purple",
    brand: "Apple",
    location_text: "Bus 12, Downtown line",
    wilaya_code: 31,
    images: demoImages("i-iphone", ["lf-phone-a"]),
    lost_or_found_at: daysAgo(1),
    created_at: daysAgo(1),
  }),
  item({
    id: "i-keys",
    type: "lost",
    title: "Bunch of keys with red lanyard",
    description: "House and car keys on a red university lanyard.",
    category_id: "c-keys",
    category: findCategory("c-keys"),
    color: "red",
    location_text: "Engineering building, Room B12",
    wilaya_code: 25,
    status: "matched",
    lost_or_found_at: daysAgo(5),
    created_at: daysAgo(5),
  }),
  item({
    id: "i-backpack",
    type: "found",
    title: "Blue North Face backpack",
    description: "Left in the gym locker area. Contains a water bottle and notebooks.",
    category_id: "c-bags",
    category: findCategory("c-bags"),
    color: "blue",
    brand: "The North Face",
    location_text: "University Gym",
    wilaya_code: 19,
    images: demoImages("i-backpack", ["lf-bag-a", "lf-bag-b", "lf-bag-c"]),
    lost_or_found_at: daysAgo(4),
    created_at: daysAgo(4),
  }),
  item({
    id: "i-macbook",
    type: "lost",
    title: "Silver MacBook Air",
    description: "13-inch MacBook Air in a grey sleeve, stickers on the lid.",
    category_id: "c-laptops",
    category: findCategory("c-laptops"),
    color: "silver",
    brand: "Apple",
    location_text: "Coffee shop on 5th Ave",
    wilaya_code: 23,
    lost_or_found_at: daysAgo(8),
    created_at: daysAgo(8),
  }),
  item({
    id: "i-glasses",
    type: "found",
    title: "Prescription glasses in a hard case",
    description: "Black hard case, found near the park bench.",
    category_id: "c-other",
    category: findCategory("c-other"),
    color: "black",
    location_text: "Riverside Park",
    wilaya_code: 6,
    status: "closed",
    closed_reason: "recovered",
    closed_at: daysAgo(1),
    lost_or_found_at: daysAgo(10),
    created_at: daysAgo(10),
  }),
];

export const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: "n-1",
    type: "match_found",
    title: "Possible match found",
    body: "We found a possible match for “Black leather wallet” — 86% confidence.",
    is_read: false,
    item_id: "i-wallet",
    match_id: "m-1",
    created_at: daysAgo(0.1),
  },
  {
    id: "n-2",
    type: "system",
    title: "Your report is live",
    body: "“Black leather wallet” is now visible to the community.",
    is_read: false,
    item_id: "i-wallet",
    match_id: null,
    created_at: daysAgo(1),
  },
  {
    id: "n-3",
    type: "system",
    title: "Welcome to Lost & Found",
    body: "Report items in under two minutes — our AI does the searching.",
    is_read: true,
    item_id: null,
    match_id: null,
    created_at: daysAgo(3),
  },
];

/** Stand-in AI suggestions so the match UI is demoable without a worker. */
/**
 * The catalogue, mirroring `app/core/pricing.py`. Duplicated rather than
 * fetched because mock mode has no backend at all — but the numbers must match,
 * or a demo quotes a price the live app does not charge.
 */
export const MOCK_PACKS: CreditPack[] = [
  {
    id: "single",
    credits: 1,
    amount: 200,
    currency: "dzd",
    unit_amount: 200,
    savings_percent: 0,
    highlighted: false,
  },
  {
    id: "trio",
    credits: 3,
    amount: 500,
    currency: "dzd",
    unit_amount: 166.67,
    savings_percent: 16,
    highlighted: true,
  },
  {
    id: "ten",
    credits: 10,
    amount: 1200,
    currency: "dzd",
    unit_amount: 120,
    savings_percent: 40,
    highlighted: false,
  },
];

/** Starts at zero credits with the free unlock intact — the real new-user state. */
export const MOCK_ENTITLEMENTS: Entitlements = {
  balance: 0,
  free_unlocks_remaining: 1,
  unlock_cost: 1,
  paywall_enabled: true,
};

/**
 * A real 16px WebP, base64'd — the same artefact the backend generates for a
 * locked card. Hand-built here rather than faked with a CSS gradient so the mock
 * exercises the actual `<img src="data:...">` path, blur radius and aspect
 * handling. If the locked card looks wrong in mock mode, it looks wrong live.
 */
const MOCK_BLUR_PREVIEW =
  "data:image/webp;base64,UklGRkwAAABXRUJQVlA4IEAAAAAQAgCdASoQAAwAA4BaJYwCdAEPUpHhGoQAAP7gpudckVcUQXSF2PFAm8cKRrekKmj8kQBffndDsZbch3vyWUAA";

/**
 * Locked, deliberately.
 *
 * The mock mirrors what the API actually sends a viewer who has not paid:
 * `candidate_item` is **null**, the scores are null, and only the reason codes
 * that describe match *strength* survive. Populating the candidate here and
 * hiding it in the component would let the demo drift from the product — and
 * would quietly teach whoever reads this file that the blur is cosmetic.
 */
export const MOCK_MATCHES: Record<string, MatchSuggestions> = {
  "i-wallet": {
    item: { id: "i-wallet", type: "lost", title: "Black leather wallet" },
    processing_status: "ready",
    locked_count: 1,
    entitlements: MOCK_ENTITLEMENTS,
    matches: [
      {
        match_id: "m-1",
        locked: true,
        candidate_item: null,
        preview: {
          blur_preview: MOCK_BLUR_PREVIEW,
          has_photo: true,
          //  same_category, time_close and same_wilaya are withheld: each one
          //  narrows the public browse page toward the answer.
          hidden_reason_count: 3,
        },
        text_score: null,
        image_score: null,
        combined_score: null,
        confidence: 0.86,
        status: "suggested",
        created_at: daysAgo(1),
        explanation: [{ code: "text_strong" }],
      },
    ],
  },
};

/**
 * What `m-1` becomes once unlocked. The mock `unlock` swaps this in, so the
 * demo shows the real reveal — blurred card to full card — rather than a
 * component that was holding the answer the whole time.
 */
export const MOCK_UNLOCKED_MATCH: MatchSuggestions["matches"][number] = {
  match_id: "m-1",
  locked: false,
  candidate_item: {
    id: "i-found-wallet",
    type: "found",
    title: "Dark bifold wallet, found at bus stop",
    primary_image_url: "https://picsum.photos/seed/lf-wallet-found/800/600",
    location_text: "Main St bus stop",
    wilaya_code: 16,
    event_date: daysAgo(1).slice(0, 10),
  },
  preview: null,
  text_score: 0.83,
  image_score: 0.91,
  combined_score: 0.88,
  confidence: 0.86,
  status: "suggested",
  created_at: daysAgo(1),
  explanation: [
    { code: "same_category", params: { name: "Wallets & Purses" } },
    { code: "text_strong" },
    { code: "time_close", params: { days: 1 } },
    { code: "same_wilaya", params: { wilaya_code: 16 } },
  ],
};
