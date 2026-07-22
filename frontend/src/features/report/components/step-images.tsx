"use client";

import * as React from "react";
import Image from "next/image";
import { ImagePlus, Info, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export interface LocalImage {
  id: string;
  file: File;
  previewUrl: string;
}

/**
 * Step 4 — Photos. Local previews only: upload to storage ships with the
 * image-pipeline milestone (M4); the report is fully functional without
 * photos, and we say so honestly.
 */
export function StepImages({
  images,
  onChange,
}: {
  images: LocalImage[];
  onChange: (images: LocalImage[]) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const next = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, 5 - images.length)
      .map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      }));
    onChange([...images, ...next]);
  }

  function remove(id: string) {
    const target = images.find((img) => img.id === id);
    if (target) URL.revokeObjectURL(target.previewUrl);
    onChange(images.filter((img) => img.id !== id));
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addFiles(e.dataTransfer.files);
        }}
        className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed bg-card p-10 text-center transition-colors hover:border-muted-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label="Add photos"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
          <ImagePlus className="h-6 w-6 text-muted-foreground" aria-hidden />
        </span>
        <span className="text-sm font-medium">
          Drag photos here, or click to choose
        </span>
        <span className="text-xs text-muted-foreground">
          Up to 5 images · JPG or PNG
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {images.length > 0 ? (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {images.map((img) => (
            <li key={img.id} className="group relative aspect-square">
              <Image
                src={img.previewUrl}
                alt={img.file.name}
                fill
                sizes="120px"
                className="rounded-xl object-cover"
                unoptimized
              />
              <Button
                type="button"
                size="icon"
                variant="destructive"
                className="absolute -right-2 -top-2 h-6 w-6 rounded-full"
                onClick={() => remove(img.id)}
                aria-label={`Remove ${img.file.name}`}
              >
                <X className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-start gap-2.5 rounded-xl border bg-muted/40 p-3.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>
          Photo upload ships with the image-matching milestone. Your selection
          is previewed here, and your report works perfectly without photos —
          you can also add them later from the item page. This step is optional.
        </p>
      </div>
    </div>
  );
}
