import type { routing } from "@/i18n/routing";
import type messages from "../../messages/en.json";

/**
 * Makes translation keys type-checked: `t("nav.doesNotExist")` becomes a
 * compile error rather than a "nav.doesNotExist" string rendered to a user.
 * English is the reference catalogue — the other locales must match its shape.
 */
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
