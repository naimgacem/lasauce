import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { routing } from "@/i18n/routing";

/**
 * Per-request i18n config. Runs on the server for every render, so the message
 * catalogue for the active locale is the only one that reaches the client.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    // Dates render identically on server and client only if both agree on a
    // zone; without this, SSR uses the container's UTC and the browser uses
    // local time, which React reports as a hydration mismatch.
    timeZone: "Africa/Algiers",
  };
});
