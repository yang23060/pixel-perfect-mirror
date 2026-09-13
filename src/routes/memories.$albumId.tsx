import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Flag,
  Grid3x3,
  Heart,
  ImagePlus,
  Images,
  MessageCircle,
  Pencil,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { FamilyMedia } from "@/components/FamilyMedia";
import { MemberAvatar } from "@/components/MemberAvatar";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/states";
import { useAuth } from "@/lib/auth";
import { useFamily } from "@/lib/family";
import { uploadFamilyMedia, useSignedUrl } from "@/lib/media";
import { shareMemoryToChat } from "@/lib/chat-share";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/memories/$albumId")({
  head: () => ({
    meta: [
      { title: "Memory — Family Circle" },
      {
        name: "description",
        content:
          "Browse this family memory one photo at a time, expand the full gallery, react and comment.",
      },
      { property: "og:title", content: "Family memory — Family Circle" },
      {
        property: "og:description",
        content: "Photos, videos, reactions and comments from a shared family memory.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AlbumPage,
});

type Photo = {
  id: string;
  url: string;
  caption: string | null;
  is_favorite: boolean;
  kind: string;
  duration_seconds: number | null;
  uploader_id: string;
  taken_at: string | null;
  created_at: string;
  position: number | null;
};

type PhotoComment = {
  id: string;
  photo_id: string;
  content: string;
  author_id: string;
  reply_to: string | null;
  created_at: string;
};

type Album = {
  id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  cover_url: string | null;
  created_by: string;
  family_id: string;
};

/** One media item at natural size, with swipe + arrow navigation. */
function Carousel({
  photos,
  index,
  onIndex,
  onExpand,
}: {
  photos: Photo[];
  index: number;
  onIndex: (i: number) => void;
  onExpand: (i: number) => void;
}) {
  const current = photos[index]!;
  const start = useRef<{ x: number; y: number } | null>(null);
  const url = useSignedUrl(current.kind === "video" ? current.url : null);
  const neighbours = [photos[index - 1], photos[index + 1]].filter(Boolean) as Photo[];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") onIndex(Math.min(photos.length - 1, index + 1));
      if (e.key === "ArrowLeft") onIndex(Math.max(0, index - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, photos.length, onIndex]);

  return (
    <div className="space-y-2">
      <div
        className="relative overflow-hidden rounded-2xl bg-muted"
        onTouchStart={(e) => {
          const t = e.touches[0]!;
          start.current = { x: t.clientX, y: t.clientY };
        }}
        onTouchEnd={(e) => {
          const s = start.current;
          const t = e.changedTouches[0];
          start.current = null;
          if (!s || !t) return;
          const dx = t.clientX - s.x;
          const dy = t.clientY - s.y;
          if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
          onIndex(dx < 0 ? Math.min(photos.length - 1, index + 1) : Math.max(0, index - 1));
        }}
      >
        {current.kind === "video" ? (
          url ? (
            <video src={url} controls playsInline className="max-h-[70vh] w-full bg-black" />
          ) : (
            <div className="flex aspect-video w-full animate-pulse items-center justify-center text-sm text-muted-foreground">
              Loading…
            </div>
          )
        ) : (
          <button
            type="button"
            onClick={() => onExpand(index)}
            aria-label="View all media in this memory"
            className="block w-full"
          >
            <FamilyMedia
              path={current.url}
              kind={current.kind}
              alt={current.caption ?? "Family photo"}
              fit="natural"
              className="max-h-[70vh] w-full"
            />
          </button>
        )}

        {photos.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous item"
              disabled={index === 0}
              onClick={() => onIndex(index - 1)}
              className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-background/80 p-2 shadow disabled:opacity-40 sm:block"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Next item"
              disabled={index === photos.length - 1}
              onClick={() => onIndex(index + 1)}
              className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-background/80 p-2 shadow disabled:opacity-40 sm:block"
            >
              <ChevronRight className="size-5" />
            </button>
            <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">
              {index + 1} of {photos.length}
            </span>
          </>
        )}
      </div>

      {/* Preload only the neighbouring items. */}
      <div className="hidden">
        {neighbours.map((p) => (
          <FamilyMedia key={p.id} path={p.url} kind={p.kind} alt="" thumbWidth={900} />
        ))}
      </div>

      {photos.length > 1 && photos.length <= 12 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              aria-label={`Go to item ${i + 1}`}
              aria-current={i === index}
              onClick={() => onIndex(i)}
              className={cn(
                "size-2 rounded-full transition-colors",
                i === index ? "bg-primary" : "bg-muted-foreground/40",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Expanded "view all photos" gallery, scrolled to the chosen item. */
function AllMediaGallery({
  photos,
  focusId,
  onPick,
  onClose,
}: {
  photos: Photo[];
  focusId: string;
  onPick: (i: number) => void;
  onClose: () => void;
}) {
  const focusRef = useRef<HTMLButtonElement>(null);
  const [flash, setFlash] = useState(true);

  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    const t = setTimeout(() => setFlash(false), 1600);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [focusId, onClose]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg">All media ({photos.length})</h3>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close the full gallery">
          <X className="mr-2 size-4" /> Close
        </Button>
      </div>
      <div className="columns-2 gap-2 sm:columns-3">
        {photos.map((p, i) => (
          <button
            key={p.id}
            ref={p.id === focusId ? focusRef : undefined}
            type="button"
            onClick={() => onPick(i)}
            aria-label={`Open item ${i + 1} of ${photos.length}`}
            className={cn(
              "mb-2 block w-full break-inside-avoid overflow-hidden rounded-xl",
              p.id === focusId && flash && "ring-4 ring-primary",
              p.id === focusId && !flash && "ring-2 ring-primary/60",
            )}
          >
            <FamilyMedia
              path={p.url}
              kind={p.kind}
              durationSeconds={p.duration_seconds}
              alt={p.caption ?? `Family memory item ${i + 1}`}
              fit="natural"
              thumbWidth={500}
              className="w-full"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Likes, caption, comments and controls for the item on screen. */
function MediaPanel({
  photo,
  album,
  onChanged,
}: {
  photo: Photo;
  album: Album;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const { familyId, isAdmin, members } = useFamily();
  const [caption, setCaption] = useState(photo.caption ?? "");
  const [comment, setComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [busy, setBusy] = useState(false);
  const canManage = photo.uploader_id === user?.id || album.created_by === user?.id || isAdmin;

  useEffect(() => {
    setCaption(photo.caption ?? "");
    setReplyTo(null);
    setEditing(null);
  }, [photo.id, photo.caption]);

  const comments = useQuery({
    queryKey: ["photo-comments", photo.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("photo_comments")
        .select("id, photo_id, content, author_id, reply_to, created_at")
        .eq("photo_id", photo.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PhotoComment[];
    },
  });

  const reactions = useQuery({
    queryKey: ["photo-reactions", photo.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("photo_reactions")
        .select("user_id, emoji")
        .eq("photo_id", photo.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const refreshFeed = () => onChanged();
  const myReaction = reactions.data?.some((r) => r.user_id === user?.id) ?? false;

  const toggleReaction = async () => {
    if (!user || !familyId) return;
    if (myReaction) {
      const { error } = await supabase
        .from("photo_reactions")
        .delete()
        .eq("photo_id", photo.id)
        .eq("user_id", user.id);
      if (error) toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("photo_reactions")
        .insert({ photo_id: photo.id, family_id: familyId, user_id: user.id, emoji: "❤️" });
      if (error) toast.error(error.message);
    }
    void reactions.refetch();
    refreshFeed();
  };

  const saveCaption = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("photos")
      .update({ caption: caption.trim() || null })
      .eq("id", photo.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Caption saved.");
    onChanged();
  };

  const toggleFavorite = async () => {
    const { error } = await supabase
      .from("photos")
      .update({ is_favorite: !photo.is_favorite })
      .eq("id", photo.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    onChanged();
  };

  const removePhoto = async () => {
    const { error } = await supabase.from("photos").delete().eq("id", photo.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Item removed.");
    onChanged();
  };

  const report = async () => {
    if (!user) return;
    const { error } = await supabase.from("content_reports").insert({
      family_id: album.family_id,
      reporter_id: user.id,
      target_type: "photo",
      target_id: photo.id,
      target_user_id: photo.uploader_id,
      reason: "Reported from a memory",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Thanks — this has been sent for review.");
  };

  const addComment = async () => {
    if (!comment.trim() || !user || !familyId) return;
    setBusy(true);
    const { error } = await supabase.from("photo_comments").insert({
      photo_id: photo.id,
      family_id: familyId,
      author_id: user.id,
      content: comment.trim(),
      reply_to: replyTo,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setComment("");
    setReplyTo(null);
    void comments.refetch();
    refreshFeed();
  };

  const saveEdit = async (id: string) => {
    if (!editText.trim()) return;
    const { error } = await supabase
      .from("photo_comments")
      .update({ content: editText.trim() })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEditing(null);
    void comments.refetch();
  };

  const deleteComment = async (id: string) => {
    const { error } = await supabase.from("photo_comments").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void comments.refetch();
    refreshFeed();
  };

  const allComments = comments.data ?? [];
  const topLevel = allComments.filter((c) => !c.reply_to);
  const repliesFor = (id: string) => allComments.filter((c) => c.reply_to === id);
  const replyTarget = replyTo ? allComments.find((c) => c.id === replyTo) : null;

  const nameFor = (id: string) =>
    members.find((m) => m.user_id === id)?.profile?.display_name ?? "Family member";
  const avatarFor = (id: string) =>
    members.find((m) => m.user_id === id)?.profile?.avatar_url ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={myReaction ? "default" : "outline"}
          size="sm"
          onClick={() => void toggleReaction()}
          aria-label={myReaction ? "Remove your like" : "Like this item"}
          aria-pressed={myReaction}
        >
          <Heart className={cn("mr-2 size-4", myReaction && "fill-current")} />
          {reactions.data?.length ?? 0}
        </Button>
        <Button
          variant={photo.is_favorite ? "default" : "outline"}
          size="sm"
          onClick={() => void toggleFavorite()}
          aria-label={photo.is_favorite ? "Remove from favourites" : "Mark as favourite"}
        >
          <Star className={cn("mr-2 size-4", photo.is_favorite && "fill-current")} />
          Favourite
        </Button>
        <p className="ml-auto text-sm text-muted-foreground">
          Added by {nameFor(photo.uploader_id)}
        </p>
        <Button variant="ghost" size="icon" aria-label="Report item" onClick={() => void report()}>
          <Flag className="size-4" />
        </Button>
        {canManage && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Delete item">
                <Trash2 className="size-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove this item?</AlertDialogTitle>
                <AlertDialogDescription>
                  It will disappear from the memory for everyone. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep it</AlertDialogCancel>
                <AlertDialogAction onClick={() => void removePhoto()}>Remove</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {canManage ? (
        <div className="flex gap-2">
          <Input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption…"
            aria-label="Item caption"
          />
          <Button onClick={() => void saveCaption()} disabled={busy}>
            Save
          </Button>
        </div>
      ) : (
        photo.caption && <p>{photo.caption}</p>
      )}

      <div className="space-y-3">
        <h4 className="flex items-center gap-2 font-display text-lg">
          <MessageCircle className="size-4" /> Comments
        </h4>
        {comments.isLoading && <LoadingBlock rows={1} />}
        {!comments.isLoading && allComments.length === 0 && (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        )}
        {topLevel.map((c) => (
          <div key={c.id} className="space-y-2">
            <div className="flex gap-3">
              <MemberAvatar
                name={nameFor(c.author_id)}
                avatarPath={avatarFor(c.author_id)}
                className="size-9"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{nameFor(c.author_id)}</p>
                {editing === c.id ? (
                  <div className="flex gap-2 pt-1">
                    <Input
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      aria-label="Edit your comment"
                    />
                    <Button size="sm" onClick={() => void saveEdit(c.id)}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <p className="break-words">{c.content}</p>
                )}
                <div className="flex gap-3 pt-0.5 text-xs font-semibold text-muted-foreground">
                  <button type="button" onClick={() => setReplyTo(c.id)} className="hover:text-foreground">
                    Reply
                  </button>
                  {c.author_id === user?.id && (
                    <>
                      <button
                        type="button"
                        aria-label="Edit your comment"
                        onClick={() => {
                          setEditing(c.id);
                          setEditText(c.content);
                        }}
                        className="flex items-center gap-1 hover:text-foreground"
                      >
                        <Pencil className="size-3" /> Edit
                      </button>
                      <button
                        type="button"
                        aria-label="Delete your comment"
                        onClick={() => void deleteComment(c.id)}
                        className="hover:text-destructive"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
            {repliesFor(c.id).map((r) => (
              <div key={r.id} className="flex gap-3 pl-8">
                <MemberAvatar
                  name={nameFor(r.author_id)}
                  avatarPath={avatarFor(r.author_id)}
                  className="size-7"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{nameFor(r.author_id)}</p>
                  {editing === r.id ? (
                    <div className="flex gap-2 pt-1">
                      <Input
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        aria-label="Edit your reply"
                      />
                      <Button size="sm" onClick={() => void saveEdit(r.id)}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <p className="break-words">{r.content}</p>
                  )}
                  {r.author_id === user?.id && (
                    <div className="flex gap-3 pt-0.5 text-xs font-semibold text-muted-foreground">
                      <button
                        type="button"
                        aria-label="Edit your reply"
                        onClick={() => {
                          setEditing(r.id);
                          setEditText(r.content);
                        }}
                        className="hover:text-foreground"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        aria-label="Delete your reply"
                        onClick={() => void deleteComment(r.id)}
                        className="hover:text-destructive"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
        {replyTarget && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            Replying to {nameFor(replyTarget.author_id)}
            <button type="button" className="font-semibold underline" onClick={() => setReplyTo(null)}>
              Cancel
            </button>
          </p>
        )}
        <div className="flex gap-2">
          <Input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={replyTarget ? "Write a reply…" : "Write a comment…"}
            aria-label="Write a comment"
          />
          <Button onClick={() => void addComment()} disabled={busy || !comment.trim()}>
            Post
          </Button>
        </div>
      </div>
    </div>
  );
}

function AlbumPage() {
  const { albumId } = Route.useParams();
  const { familyId, members } = useFamily();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [index, setIndex] = useState(0);
  const [gallery, setGallery] = useState<string | null>(null);
  const [favouritesOnly, setFavouritesOnly] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["album", albumId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("albums")
        .select(
          "id, title, description, event_date, cover_url, created_by, family_id, photos(id, url, caption, is_favorite, kind, duration_seconds, uploader_id, taken_at, created_at, position)",
        )
        .eq("id", albumId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as (Album & { photos: Photo[] }) | null;
    },
  });

  const allPhotos = useMemo(
    () =>
      (data?.photos ?? [])
        .slice()
        .sort(
          (a, b) =>
            (a.position ?? 0) - (b.position ?? 0) ||
            a.created_at.localeCompare(b.created_at) ||
            a.id.localeCompare(b.id),
        ),
    [data],
  );
  const photos = allPhotos.filter((p) => !favouritesOnly || p.is_favorite);
  const safeIndex = Math.min(index, Math.max(0, photos.length - 1));
  const current = photos[safeIndex] ?? null;

  useEffect(() => {
    setIndex(0);
  }, [favouritesOnly]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["album", albumId] });
    void queryClient.invalidateQueries({ queryKey: ["albums"] });
    void queryClient.invalidateQueries({ queryKey: ["albums-engagement"] });
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length || !familyId || !user) return;
    setUploading(true);
    const uploaded: { path: string; kind: string }[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const up = await uploadFamilyMedia(familyId, "albums", files[i]!);
        const { error: pErr } = await supabase.from("photos").insert({
          album_id: albumId,
          family_id: familyId,
          uploader_id: user.id,
          url: up.path,
          kind: up.kind,
          duration_seconds: up.duration,
          position: allPhotos.length + i,
        });
        if (pErr) throw pErr;
        uploaded.push({ path: up.path, kind: up.kind });
      }
      if (uploaded.length) {
        void shareMemoryToChat({
          familyId,
          senderId: user.id,
          text: `📸 ${uploaded.length === 1 ? "A new photo was" : `${uploaded.length} new photos were`} added to “${data?.title ?? "a memory"}”`,
          media: uploaded,
        });
      }
      toast.success(files.length === 1 ? "Item added." : "Items added.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add the files.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const contributorIds = Array.from(new Set(allPhotos.map((p) => p.uploader_id)));
  const contributors = contributorIds.map((id) => ({
    id,
    name: members.find((m) => m.user_id === id)?.profile?.display_name ?? "Family member",
    avatar: members.find((m) => m.user_id === id)?.profile?.avatar_url ?? null,
  }));
  const creatorName = data
    ? (members.find((m) => m.user_id === data.created_by)?.profile?.display_name ?? "Family member")
    : "";

  return (
    <AppShell title={data?.title ?? "Memory"}>
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/memories">
            <ArrowLeft className="mr-2 size-4" /> All memories
          </Link>
        </Button>

        {isLoading && <LoadingBlock />}
        {error && <ErrorState message="We couldn't load this memory." />}
        {!isLoading && !error && !data && (
          <EmptyState
            icon={<Images className="size-8" />}
            title="Memory not found"
            description="It may have been deleted, or it belongs to another family."
          />
        )}

        {data && (
          <>
            <div className="card-soft p-4">
              <h2 className="font-display text-2xl">{data.title}</h2>
              <p className="text-sm text-muted-foreground">
                {allPhotos.length} item{allPhotos.length === 1 ? "" : "s"}
                {data.event_date ? ` · ${format(new Date(data.event_date), "d MMMM yyyy")}` : ""}
                {creatorName ? ` · by ${creatorName}` : ""}
              </p>
              {data.description && <p className="mt-2">{data.description}</p>}
              {contributors.length > 0 && (
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {contributors.slice(0, 5).map((c) => (
                      <MemberAvatar
                        key={c.id}
                        name={c.name}
                        avatarPath={c.avatar}
                        className="size-8 ring-2 ring-card"
                      />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {contributors.length} contributor{contributors.length === 1 ? "" : "s"}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => fileInput.current?.click()} disabled={uploading}>
                <ImagePlus className="mr-2 size-5" />
                {uploading ? "Adding…" : "Add yours"}
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                aria-label="Add photos or videos"
                onChange={(e) => void addPhotos(e.target.files)}
              />
              <Button
                variant={favouritesOnly ? "default" : "outline"}
                onClick={() => setFavouritesOnly((v) => !v)}
              >
                <Star className={cn("mr-2 size-4", favouritesOnly && "fill-current")} />
                Favourites
              </Button>
              {photos.length > 1 && !gallery && current && (
                <Button variant="outline" onClick={() => setGallery(current.id)}>
                  <Grid3x3 className="mr-2 size-4" /> View all media
                </Button>
              )}
            </div>

            {photos.length === 0 ? (
              <EmptyState
                icon={<Images className="size-8" />}
                title={favouritesOnly ? "No favourites yet" : "Nothing here yet"}
                description={
                  favouritesOnly
                    ? "Tap the star on an item to keep it here."
                    : "Add the first photos or videos to this memory."
                }
              />
            ) : gallery ? (
              <AllMediaGallery
                photos={photos}
                focusId={gallery}
                onPick={(i) => {
                  setIndex(i);
                  setGallery(null);
                }}
                onClose={() => setGallery(null)}
              />
            ) : (
              current && (
                <>
                  <Carousel
                    photos={photos}
                    index={safeIndex}
                    onIndex={setIndex}
                    onExpand={(i) => setGallery(photos[i]!.id)}
                  />
                  <MediaPanel photo={current} album={data} onChanged={refresh} />
                </>
              )
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
