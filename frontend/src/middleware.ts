import createMiddleware from "next-intl/middleware";

import { routing } from "@/i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Match everything except Next internals, the API proxy, stored media, and
  // any path with a file extension (favicon, robots.txt, images). Locale
  // prefixing those would break them.
  matcher: ["/((?!api|_next|media|.*\\..*).*)"],
};
