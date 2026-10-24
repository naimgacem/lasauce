"use client";

import * as React from "react";
import Image, { type StaticImageData } from "next/image";
import { LoaderCircle, Play, RotateCcw } from "lucide-react";

import { formatDuration, isoDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface VideoPlayerLabels {
  /** Shown on the poster, and the start of the play button's accessible name. */
  play: string;
  /** Accessible name of the <video> element once it takes over. */
  video: string;
  /** Announced while the first frames load. */
  loading: string;
  /** Shown on the poster when the file fails to load; pressing it retries. */
  error: string;
  retry: string;
  /** Fallback for browsers without <video> support; links to the file. */
  unsupported: string;
}

/**
 * idle     poster + play button. Nothing fetched yet (`preload="none"`).
 * loading  play pressed, first frame not decoded yet. The poster stays up, so
 *          the box never blinks to an empty frame in between.
 * started  the browser's own controls run playback from here — pause, seek,
 *          volume, fullscreen — keyboard-operable and localised by the browser.
 * error    the file failed. The poster comes back and offers a retry.
 */
type Status = "idle" | "loading" | "started" | "error";

/**
 * A click-to-play video: a branded poster up front, native controls after.
 *
 * Nothing autoplays and nothing downloads until someone asks — the element
 * exists from the first render (so play() can run inside the click itself) but
 * with `preload="none"`. Pass the player a `key` of its source: a new source
 * should mean a fresh element, not the old one's state carried across.
 */
export function VideoPlayer({
  src,
  poster,
  durationSeconds,
  labels,
  aspectRatio = "16 / 9",
  backdrop = "#000",
  sizes = "100vw",
  className,
}: {
  /** Same-origin URL of the file, e.g. `/videos/intro.mp4`. */
  src: string;
  poster: StaticImageData;
  durationSeconds: number;
  labels: VideoPlayerLabels;
  /** The source's aspect ratio — reserves the box before anything loads. */
  aspectRatio?: string;
  /** Fill behind the frame: shows while loading and around a letterboxed source. */
  backdrop?: string;
  /** `sizes` for the poster image — the player's real rendered width. */
  sizes?: string;
  className?: string;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const posterRef = React.useRef<HTMLButtonElement>(null);
  const [status, setStatus] = React.useState<Status>("idle");
  const started = status === "started";

  // Browsers pause a detached element anyway; this makes it explicit for the
  // language switch, which unmounts the player mid-playback.
  React.useEffect(() => {
    const video = videoRef.current;
    return () => video?.pause();
  }, []);

  function play() {
    const video = videoRef.current;
    if (!video || status === "loading" || status === "started") return;
    if (status === "error") video.load();
    setStatus("loading");
    // Called here, inside the click, and not from an effect after re-render:
    // Safari only lets playback start with sound within the user's gesture.
    video.play().catch((error: unknown) => {
      const name = error instanceof DOMException ? error.name : "";
      // Superseded by a newer load() or play() — not a failure.
      if (name === "AbortError") return;
      // The browser refused to start it on our behalf. Hand over the native
      // controls: a press on their own play button is always accepted.
      setStatus(name === "NotAllowedError" ? "started" : "error");
    });
  }

  function handlePlaying() {
    // The poster button is about to disappear. Move keyboard focus to the
    // player it uncovered, rather than letting it fall back to the page top.
    if (document.activeElement === posterRef.current) {
      videoRef.current?.focus({ preventScroll: true });
    }
    setStatus("started");
  }

  return (
    <div
      className={cn(
        // The hero search field's bezel — same card, hairline and inset — so
        // the two framed surfaces on the page read as one family.
        "rounded-2xl border bg-card p-1.5 shadow-sm",
        // The poster and the <video> sit in an overflow-hidden frame that
        // would clip a focus ring of their own, so the bezel carries it.
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background",
        className,
      )}
    >
      <div
        className="relative overflow-hidden rounded-xl"
        style={{ aspectRatio, backgroundColor: backdrop }}
      >
        <video
          ref={videoRef}
          src={src}
          preload="none"
          playsInline
          controls={started}
          tabIndex={started ? 0 : -1}
          aria-label={labels.video}
          onPlaying={handlePlaying}
          onError={() => setStatus("error")}
          // `contain`: whatever the source's shape, it is never cropped or stretched.
          className="absolute inset-0 h-full w-full object-contain focus-visible:ring-0 focus-visible:ring-offset-0"
        >
          <a href={src}>{labels.unsupported}</a>
        </video>

        <button
          ref={posterRef}
          type="button"
          onClick={play}
          className={cn(
            "group absolute inset-0 flex flex-col items-center justify-center gap-2 text-white sm:gap-3",
            "transition-[opacity,visibility] duration-300 ease-out",
            "focus-visible:ring-0 focus-visible:ring-offset-0",
            started && "pointer-events-none invisible opacity-0",
          )}
        >
          {/* Decorative: the button's name comes from its visible label. No
              scrim over it — the label carries its own dark pill, and an
              untouched poster hands over to the first frame without a jump. */}
          <Image
            src={poster}
            alt=""
            fill
            sizes={sizes}
            placeholder="blur"
            className="object-cover"
          />

          <span
            className="relative flex size-14 items-center justify-center rounded-full bg-white text-primary shadow-lg ring-1 ring-black/5 transition-transform duration-200 ease-out group-hover:scale-105 group-active:scale-95 sm:size-20"
            aria-hidden
          >
            {status === "loading" ? (
              <LoaderCircle className="size-6 animate-spin sm:size-8" />
            ) : status === "error" ? (
              <RotateCcw className="size-6 sm:size-8" />
            ) : (
              // Media glyphs never mirror — play points the way time runs in
              // every script. The nudge centres the triangle optically.
              <Play className="size-6 translate-x-[2px] fill-current sm:size-8" />
            )}
          </span>

          <span className="relative inline-flex max-w-[90%] items-center gap-2 rounded-full bg-black/45 px-3 py-1 text-caption backdrop-blur-sm sm:px-3.5 sm:py-1.5 sm:text-body-sm sm:font-medium">
            {status === "error" ? (
              `${labels.error} ${labels.retry}`
            ) : (
              <>
                <span>{labels.play}</span>
                <span className="opacity-60" aria-hidden>
                  ·
                </span>
                <time dateTime={isoDuration(durationSeconds)} className="tabular-nums">
                  {formatDuration(durationSeconds)}
                </time>
              </>
            )}
          </span>
        </button>

        <span role="status" className="sr-only">
          {status === "loading"
            ? labels.loading
            : status === "error"
              ? labels.error
              : null}
        </span>
      </div>
    </div>
  );
}
