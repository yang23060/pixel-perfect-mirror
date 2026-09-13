import { useEffect, useState } from "react";
import { ImageIcon, Play, X } from "lucide-react";
import { formatDuration, useSignedUrl, type MediaKind } from "@/lib/media";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export type MediaItem = {
  id: string;
  url: string;
  kind: string;
  duration_seconds?: number | null;
  caption?: string | null;
};

/** Thumbnail for a photo or video stored in the private family bucket. */
export function FamilyMedia({
  path,
  kind,
  alt,
  className,
  durationSeconds,
  onClick,
  fit = "cover",
  thumbWidth,
}: {
  path?: string | null;
  kind: MediaKind | string;
  alt: string;
  className?: string;
  durationSeconds?: number | null;
  onClick?: () => void;
  /** "natural" keeps the media's own aspect ratio (masonry, carousel). */
  fit?: "cover" | "natural";
  /** Request a smaller rendition for grid thumbnails. */
  thumbWidth?: number;
}) {
  const url = useSignedUrl(path, "family-media", kind === "image" ? thumbWidth : undefined);
  const badge = formatDuration(durationSeconds ?? undefined);
  const natural = fit === "natural";

  if (!path) return null;
  if (!url) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground",
          natural && "aspect-[4/5] w-full animate-pulse",
          className,
        )}
      >
        <ImageIcon className="size-6 opacity-50" />
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {kind === "video" ? (
        <video
          src={url}
          muted
          playsInline
          preload="metadata"
          onClick={onClick}
          className={cn(
            natural ? "h-auto w-full object-contain" : "size-full object-cover",
            onClick && "cursor-pointer",
          )}
        />
      ) : (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          onClick={onClick}
          className={cn(
            natural ? "h-auto w-full object-contain" : "size-full object-cover",
            onClick && "cursor-zoom-in",
          )}
        />
      )}
      {kind === "video" && (
        <span className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">
          <Play className="size-3 fill-current" />
          {badge ?? "Video"}
        </span>
      )}
    </div>
  );
}

/** Full-screen viewer with swipe-free prev/next controls. */
export function MediaLightbox({
  items,
  index,
  onClose,
  onIndexChange,
}: {
  items: MediaItem[];
  index: number | null;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}) {
  const open = index !== null;
  const current = open ? items[index!] : undefined;
  const url = useSignedUrl(current?.url ?? null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") onIndexChange(Math.min(items.length - 1, (index ?? 0) + 1));
      if (e.key === "ArrowLeft") onIndexChange(Math.max(0, (index ?? 0) - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, items.length, onIndexChange]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl border-none bg-black/95 p-2 text-white">
        <DialogTitle className="sr-only">Media viewer</DialogTitle>
        <button
          aria-label="Close viewer"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-black/50 p-2"
        >
          <X className="size-5" />
        </button>
        <div className="flex min-h-[50vh] items-center justify-center">
          {url && current?.kind === "video" ? (
            <video src={url} controls autoPlay className="max-h-[75vh] w-full rounded-lg" />
          ) : url ? (
            <img src={url} alt={current?.caption ?? "Family media"} className="max-h-[75vh] rounded-lg object-contain" />
          ) : (
            <p className="text-sm opacity-80">Loading…</p>
          )}
        </div>
        {current?.caption && <p className="px-3 pb-2 text-center text-sm opacity-90">{current.caption}</p>}
        {items.length > 1 && (
          <div className="flex items-center justify-center gap-4 pb-2">
            <button
              aria-label="Previous"
              disabled={(index ?? 0) === 0}
              onClick={() => onIndexChange(Math.max(0, (index ?? 0) - 1))}
              className="rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm opacity-80">
              {(index ?? 0) + 1} / {items.length}
            </span>
            <button
              aria-label="Next"
              disabled={(index ?? 0) >= items.length - 1}
              onClick={() => onIndexChange(Math.min(items.length - 1, (index ?? 0) + 1))}
              className="rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Hook-free helper for components that manage their own lightbox index. */
export function useLightbox() {
  const [index, setIndex] = useState<number | null>(null);
  return { index, open: setIndex, close: () => setIndex(null), setIndex };
}
