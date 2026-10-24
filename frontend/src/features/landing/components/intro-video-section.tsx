import { AudioLines, Clock3 } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { VideoPlayer } from "@/components/shared/video-player";
import { INTRO_BACKDROP, INTRO_VIDEOS } from "@/features/landing/intro-videos";
import type { Locale } from "@/i18n/routing";
import { formatDuration, isoDuration } from "@/lib/format";

/**
 * The introduction film, directly under the hero. The hero's three steps say
 * what happens after a report; this shows it happening, for the visitor who
 * wants the whole picture before trusting the registry with anything.
 *
 * The cut follows the site language, so the existing language switcher is
 * also the video's: switching re-renders the page under the new locale, and
 * the player — keyed by its source — mounts fresh on the new cut rather than
 * carrying a position across into a different recording. Only the active
 * locale's file is ever referenced, and nothing downloads until play.
 *
 * Server-rendered, like the hero, so the copy paints with the HTML and does
 * not animate in; only the player hydrates.
 */
export async function IntroVideoSection({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "landing.video" });
  const tc = await getTranslations({ locale, namespace: "common" });
  const video = INTRO_VIDEOS[locale];

  return (
    <section aria-labelledby="intro-video" className="border-b">
      <div className="container grid gap-8 py-12 md:gap-10 md:py-20 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-center lg:gap-16 xl:gap-24">
        <div className="max-w-xl">
          <p className="text-overline uppercase text-muted-foreground">
            {t("eyebrow")}
          </p>
          <h2 id="intro-video" className="mt-3 text-heading-1">
            {t("title")}
          </h2>
          <p className="mt-4 text-body-lg text-muted-foreground">{t("body")}</p>

          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-body-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 shrink-0" aria-hidden />
              <span className="sr-only">{t("durationLabel")}</span>
              <time
                dateTime={isoDuration(video.durationSeconds)}
                className="tabular-nums"
              >
                {formatDuration(video.durationSeconds)}
              </time>
            </li>
            <li className="flex items-center gap-2">
              <AudioLines className="h-4 w-4 shrink-0" aria-hidden />
              {t("narration")}
            </li>
          </ul>
        </div>

        <VideoPlayer
          key={video.src}
          src={video.src}
          poster={video.poster}
          durationSeconds={video.durationSeconds}
          backdrop={INTRO_BACKDROP}
          // The wider of the two columns: ~3/5 of the container from `lg`,
          // capped by the container's 1400px.
          sizes="(min-width: 1400px) 820px, (min-width: 1024px) 60vw, 100vw"
          labels={{
            play: t("play"),
            video: t("videoLabel"),
            loading: t("loading"),
            error: t("error"),
            retry: tc("retry"),
            unsupported: t("unsupported"),
          }}
        />
      </div>
    </section>
  );
}
