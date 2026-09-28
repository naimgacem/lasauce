import { notFound } from "next/navigation";

/**
 * Unknown paths under a locale match no route, so without this Next serves its
 * own unstyled, English-only 404. Matching them here and calling notFound()
 * routes them to `[locale]/not-found.tsx` instead, inside the locale layout.
 */
export default function CatchAll() {
  notFound();
}
