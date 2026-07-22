import type { User } from "@/types/auth";
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

/** Fake AI suggestions so the M5 match UI can be built before the engine. */
export const MOCK_MATCHES: Record<string, MatchSuggestions> = {
  "i-wallet": {
    item: { id: "i-wallet", type: "lost", title: "Black leather wallet" },
    matches: [
      {
        match_id: "m-1",
        candidate_item: {
          id: "i-found-wallet",
          type: "found",
          title: "Dark bifold wallet, found at bus stop",
          primary_image_url: "https://picsum.photos/seed/lf-wallet-found/800/600",
          location_text: "Main St bus stop",
          event_date: daysAgo(1).slice(0, 10),
        },
        text_score: 0.83,
        image_score: 0.91,
        combined_score: 0.88,
        confidence: 0.86,
        status: "suggested",
        explanation: [
          "same category",
          "image strongly similar",
          "found 1 day after lost",
          "300 m from reported location",
        ],
      },
    ],
  },
};
