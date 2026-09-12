import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSignedUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

export function MemberAvatar({
  name,
  avatarPath,
  className,
}: {
  name?: string | null;
  avatarPath?: string | null;
  className?: string;
}) {
  const url = useSignedUrl(avatarPath, "avatars");
  const initials = (name ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <Avatar className={cn("size-11 border border-border", className)}>
      {url ? <AvatarImage src={url} alt={name ?? "Family member"} /> : null}
      <AvatarFallback className="bg-sage font-semibold text-sage-foreground">
        {initials || "?"}
      </AvatarFallback>
    </Avatar>
  );
}
