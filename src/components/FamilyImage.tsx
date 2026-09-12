import { useSignedUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import { ImageIcon } from "lucide-react";

export function FamilyImage({
  path,
  alt,
  className,
  onClick,
}: {
  path?: string | null;
  alt: string;
  className?: string;
  onClick?: () => void;
}) {
  const url = useSignedUrl(path);
  if (!path) return null;
  if (!url) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground",
          className,
        )}
      >
        <ImageIcon className="size-6 opacity-50" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onClick={onClick}
      className={cn("object-cover", onClick && "cursor-zoom-in", className)}
    />
  );
}
