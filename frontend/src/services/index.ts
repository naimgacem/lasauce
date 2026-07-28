/**
 * Data-access barrel — THE import point for all data access.
 * Switches between real HTTP clients and mock adapters per env; everything
 * above (hooks, components) is implementation-blind.
 */
import { env } from "@/lib/env";

import { authClient } from "./auth.client";
import { categoriesClient } from "./categories.client";
import type { Api } from "./contracts";
import { itemsClient } from "./items.client";
import { matchesClient } from "./matches.client";
import { mockApi } from "./mock/api";
import { notificationsClient } from "./notifications.client";

const realApi: Api = {
  auth: authClient,
  items: itemsClient,
  categories: categoriesClient,
  notifications: notificationsClient,
  matches: matchesClient,
};

export const api: Api = env.useMocks ? mockApi : realApi;
