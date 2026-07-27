/**
 * Data-access barrel — THE import point for all data access.
 * Switches between real HTTP clients and mock adapters per env; everything
 * above (hooks, components) is implementation-blind.
 */
import { env } from "@/lib/env";

import type { Api } from "./contracts";
import { firebaseApi } from "./firebase-api";

const realApi: Api = {
  auth: firebaseApi.auth,
  items: firebaseApi.items,
  categories: firebaseApi.categories,
  notifications: firebaseApi.notifications,
  matches: firebaseApi.matches,
};

export const api: Api = env.useMocks ? firebaseApi : realApi;
