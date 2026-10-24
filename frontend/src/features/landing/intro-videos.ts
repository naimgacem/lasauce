import type { StaticImageData } from "next/image";

import type { Locale } from "@/i18n/routing";

import poster from "./assets/intro-poster.webp";

export interface IntroVideo {
  /** Served from `public/`, so a root-relative URL — never a filesystem path. */
  src: string;
  /**
   * Known up front because the file is not fetched until someone presses play,
   * so the element cannot report its own length in time to show it.
   */
  durationSeconds: number;
  poster: StaticImageData;
}

/**
 * The landing-page introduction, one cut per locale, each narrated in that
 * locale's language — Algerian Darija for `ar`. Typed as a `Record` over every
 * locale, so adding a language without its video is a compile error rather
 * than a silently empty section.
 *
 * All three share one poster: the cuts are the same animation under different
 * narration, and the chosen frame has no on-screen text to translate.
 *
 * The files are web encodes of the masters (H.264 1080p at CRF 21, audio
 * passed through untouched, `+faststart` so playback starts before the whole
 * file arrives). To replace one, re-encode the same way and keep the name.
 */
export const INTRO_VIDEOS: Record<Locale, IntroVideo> = {
  ar: { src: "/videos/sabtou-intro-ar.mp4", durationSeconds: 85, poster },
  fr: { src: "/videos/sabtou-intro-fr.mp4", durationSeconds: 79, poster },
  en: { src: "/videos/sabtou-intro-en.mp4", durationSeconds: 77, poster },
};

/**
 * The animation's own background green, sampled from the frames. The player
 * fills with it while a cut loads, so the box never flashes black between the
 * poster and the first frame.
 */
export const INTRO_BACKDROP = "#1F8C54";
