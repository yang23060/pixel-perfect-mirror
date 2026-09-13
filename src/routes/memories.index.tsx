import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Heart, Images, Layers, MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { FamilyMedia } from "@/components/FamilyMedia";
import { MemberAvatar } from "@/components/MemberAvatar";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/states";
import { useAuth } from "@/lib/auth";
import { useFamily } from "@/lib/family";
import { uploadFamilyMedia, validateMedia } from "@/lib/media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

export const Route = createFileRoute("/memories/")({
  head: () => ({
    meta: [
      { title: "Memories — Family Circle" },
      {
        name: "description",
        content:
          "Shared family photo albums in a warm masonry wall: create an album, add captions and revisit favourites.",
      },
      { property: "og:title", content: "Memories — Family Circle" },
      { property: "og:description", content: "Your family photobook, kept private and safe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MemoriesPage,
});

const PAGE_SIZE = 12;
const SCROLL_KEY = "memories-scroll";

type AlbumPhoto = {
  id: string;
  url: string;
  caption: string | null;
  is_favorite: boolean;
  kind: string;
  duration_seconds: number | null;
  uploader_id: string;
  position: number | null;
  created_at: string;
};

type AlbumRow = {
  id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  cover_url: string | null;
  created_by: string;
  created_at: string;
  photos: AlbumPhoto[];
};

type QueuedFile = {
  file: File;
  status: "waiting" | "uploading" | "done" | "failed";
  error?: string;
  path?: string;
};

function NewAlbumDialog() {
  const { familyId } = useFamily();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [coverIndex, setCoverIndex] = useState(0);
  const [busy, setBusy] = useState(false);

  const pick = (files: File[]) => {
    const next: QueuedFile[] = [];
    for (const file of files) {
      const problem = validateMedia(file);
      if (problem) toast.error(`${file.name}: ${problem}`);
      else next.push({ file, status: "waiting" });
    }
    setQueue(next);
    setCoverIndex(0);
  };

  const move = (index: number, direction: -1 | 1) => {
    setQueue((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(target, 0, item!);
      return copy;
    });
    setCoverIndex((c) => (c === index ? index + direction : c === index + direction ? index : c));
  };

  const uploadInto = async (albumId: string, indexes: number[]) => {
    const uploaded: { path: string; kind: string }[] = [];
    if (!familyId || !user) return uploaded;
    for (const i of indexes) {
      const item = queue[i];
      if (!item) continue;
      setQueue((prev) => prev.map((q, idx) => (idx === i ? { ...q, status: "uploading" } : q)));
      try {
        const up = await uploadFamilyMedia(familyId, "albums", item.file);
        const { error } = await supabase.from("photos").insert({
          album_id: albumId,
          family_id: familyId,
          uploader_id: user.id,
          url: up.path,
          kind: up.kind,
          duration_seconds: up.duration,
          position: i,
        });
        if (error) throw error;
        setQueue((prev) =>
          prev.map((q, idx) => (idx === i ? { ...q, status: "done", path: up.path } : q)),
        );
        if (i === coverIndex && up.kind === "image") {
          await supabase.from("albums").update({ cover_url: up.path }).eq("id", albumId);
        }
        uploaded.push({ path: up.path, kind: up.kind });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setQueue((prev) =>
          prev.map((q, idx) => (idx === i ? { ...q, status: "failed", error: message } : q)),
        );
      }
    }
    return uploaded;
  };

  const [albumId, setAlbumId] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !familyId || !user) return;
    if (!title.trim()) {
      toast.error("Give your album a title.");
      return;
    }
    setBusy(true);
    try {
      let id = albumId;
      if (!id) {
        const { data, error } = await supabase
          .from("albums")
          .insert({
            family_id: familyId,
            created_by: user.id,
            title: title.trim(),
            description: description.trim() || null,
            event_date: date || null,
          })
          .select("id")
          .single();
        if (error) throw error;
        id = data.id;
        setAlbumId(id);
      }
      const pendingIndexes = queue
        .map((q, i) => (q.status === "done" ? -1 : i))
        .filter((i) => i >= 0);
      const uploaded = await uploadInto(id, pendingIndexes);
      const stillFailed = queue.some((q) => q.status === "failed");
      void queryClient.invalidateQueries({ queryKey: ["albums"] });
      if (stillFailed) {
        toast.error("Some files didn't upload. Tap “Retry failed” to try again.");
        return;
      }
      void shareMemoryToChat({
        familyId,
        senderId: user.id,
        text: `📸 New memory: “${title.trim()}”`,
        media: uploaded,
      });
      toast.success("Album created.");
      setOpen(false);
      setTitle("");
      setDescription("");
      setDate("");
      setQueue([]);
      setAlbumId(null);
      setCoverIndex(0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the album.");
    } finally {
      setBusy(false);
    }
  };

  const retryFailed = async () => {
    if (!albumId) return;
    setBusy(true);
    const indexes = queue.map((q, i) => (q.status === "failed" ? i : -1)).filter((i) => i >= 0);
    await uploadInto(albumId, indexes);
    setBusy(false);
    void queryClient.invalidateQueries({ queryKey: ["albums"] });
  };

  const failedCount = queue.filter((q) => q.status === "failed").length;
  const doneCount = queue.filter((q) => q.status === "done").length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg">
          <Images className="mr-2 size-5" /> New album
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create an album</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="al-title">Title</Label>
            <Input id="al-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="al-desc">Description</Label>
            <Textarea
              id="al-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="al-date">Date of the memory</Label>
            <Input id="al-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="al-photos">Photos & videos</Label>
            <Input
              id="al-photos"
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={(e) => pick(Array.from(e.target.files ?? []))}
            />
            {queue.length > 0 && (
              <ul className="space-y-1.5 pt-1">
                {queue.map((q, i) => (
                  <li key={`${q.file.name}-${i}`} className="flex items-center gap-2 text-sm">
                    <button
                      type="button"
                      aria-label={`Use ${q.file.name} as cover`}
                      onClick={() => setCoverIndex(i)}
                      className={`rounded-full border px-2 py-0.5 text-xs ${
                        coverIndex === i ? "border-primary bg-sage/50 font-semibold" : "border-border"
                      }`}
                    >
                      Cover
                    </button>
                    <span className="min-w-0 flex-1 truncate">{q.file.name}</span>
                    <span className="text-muted-foreground">
                      {q.status === "waiting" && "waiting"}
                      {q.status === "uploading" && "uploading…"}
                      {q.status === "done" && "done"}
                      {q.status === "failed" && (q.error ?? "failed")}
                    </span>
                    <button
                      type="button"
                      aria-label={`Move ${q.file.name} up`}
                      onClick={() => move(i, -1)}
                      className="px-1 text-muted-foreground"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${q.file.name} down`}
                      onClick={() => move(i, 1)}
                      className="px-1 text-muted-foreground"
                    >
                      ↓
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {busy && queue.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Uploading {doneCount}/{queue.length}…
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            {failedCount > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => void retryFailed()}
                disabled={busy}
              >
                Retry failed ({failedCount})
              </Button>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Saving…" : "Create album"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type CommentRow = {
  id: string;
  photo_id: string;
  content: string;
  author_id: string;
  reply_to: string | null;
  created_at: string;
};

type Engagement = {
  likes: Map<string, string[]>;
  comments: Map<string, number>;
  top: Map<string, { top: CommentRow; reply: CommentRow | null }>;
  likePhoto: Map<string, string>;
};

function sortPhotos(photos: AlbumPhoto[]) {
  return photos
    .slice()
    .sort(
      (a, b) =>
        (a.position ?? 0) - (b.position ?? 0) ||
        a.created_at.localeCompare(b.created_at) ||
        a.id.localeCompare(b.id),
    );
}

/** One masonry tile: cover media plus title, counts and the top comment. */
function MemoryCard({
  album,
  engagement,
  onLike,
  onOpen,
  canManage,
  onDelete,
}: {
  album: AlbumRow;
  engagement: Engagement | undefined;
  onLike: (albumId: string, photoId: string, liked: boolean) => void;
  onOpen: () => void;
  canManage: boolean;
  onDelete: () => void;
}) {
  const { members } = useFamily();
  const { user } = useAuth();
  const photos = sortPhotos(album.photos);
  const cover =
    photos.find((p) => p.url === album.cover_url) ??
    photos.find((p) => p.kind === "image") ??
    photos[0] ??
    null;

  const likePhotoId = engagement?.likePhoto.get(album.id) ?? cover?.id ?? null;
  const likers = likePhotoId ? (engagement?.likes.get(likePhotoId) ?? []) : [];
  const liked = !!user && likers.includes(user.id);
  const commentCount = engagement?.comments.get(album.id) ?? 0;
  const preview = engagement?.top.get(album.id) ?? null;

  const profileFor = (id: string) => members.find((m) => m.user_id === id)?.profile ?? null;
  const nameFor = (id: string) => profileFor(id)?.display_name ?? "Family member";

  return (
    <article className="card-soft mb-4 break-inside-avoid overflow-hidden">
      <Link
        to="/memories/$albumId"
        params={{ albumId: album.id }}
        onClick={onOpen}
        aria-label={`Open ${album.title}`}
        className="relative block"
      >
        {cover ? (
          <FamilyMedia
            path={cover.url}
            kind={cover.kind}
            durationSeconds={cover.duration_seconds}
            alt={cover.caption ?? album.title}
            fit="natural"
            thumbWidth={600}
            className="w-full"
          />
        ) : (
          <div className="flex aspect-[4/5] items-center justify-center bg-muted text-muted-foreground">
            <Images className="size-8" />
          </div>
        )}
        {photos.length > 1 && (
          <span
            className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white"
            aria-label={`${photos.length} items in this memory`}
          >
            <Layers className="size-3" />
            {photos.length}
          </span>
        )}
      </Link>

      <div className="space-y-2 p-3">
        <div className="flex items-start gap-2">
          <Link
            to="/memories/$albumId"
            params={{ albumId: album.id }}
            onClick={onOpen}
            className="min-w-0 flex-1"
          >
            <h3 className="line-clamp-2 font-display text-base leading-snug">{album.title}</h3>
            {album.event_date && (
              <p className="text-xs text-muted-foreground">
                {format(new Date(album.event_date), "d MMM yyyy")}
              </p>
            )}
          </Link>
          {canManage && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  aria-label={`Delete ${album.title}`}
                  className="p-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this memory?</AlertDialogTitle>
                  <AlertDialogDescription>
                    “{album.title}” and its {photos.length} item{photos.length === 1 ? "" : "s"} will
                    be removed for everyone. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep memory</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete}>Delete memory</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <button
            type="button"
            onClick={() => likePhotoId && onLike(album.id, likePhotoId, liked)}
            disabled={!likePhotoId}
            aria-label={liked ? "Remove your like" : "Like this memory"}
            aria-pressed={liked}
            className="flex items-center gap-1.5 transition-colors hover:text-primary"
          >
            <Heart className={`size-4 ${liked ? "fill-primary text-primary" : ""}`} />
            {likers.length}
          </button>
          <span className="flex items-center gap-1.5">
            <MessageCircle className="size-4" />
            {commentCount}
          </span>
        </div>

        {preview && (
          <div className="space-y-1 text-sm">
            <div className="flex gap-2">
              <MemberAvatar
                name={nameFor(preview.top.author_id)}
                avatarPath={profileFor(preview.top.author_id)?.avatar_url ?? null}
                className="size-6 shrink-0"
              />
              <p className="line-clamp-2 min-w-0">
                <span className="font-semibold">{nameFor(preview.top.author_id)}</span>{" "}
                {preview.top.content}
              </p>
            </div>
            {preview.reply && (
              <p className="ml-8 line-clamp-2 text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {nameFor(preview.reply.author_id)}
                </span>{" "}
                {preview.reply.content}
              </p>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function MemoriesPage() {
  const { familyId, isAdmin } = useFamily();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const sentinel = useRef<HTMLDivElement>(null);

  const feed = useInfiniteQuery({
    queryKey: ["albums", familyId],
    enabled: !!familyId,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const from = (pageParam as number) * PAGE_SIZE;
      const { data, error } = await supabase
        .from("albums")
        .select(
          "id, title, description, event_date, cover_url, created_by, created_at, photos(id, url, caption, is_favorite, kind, duration_seconds, uploader_id, position, created_at)",
        )
        .eq("family_id", familyId!)
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      return (data ?? []) as unknown as AlbumRow[];
    },
    getNextPageParam: (last, all) => (last.length < PAGE_SIZE ? undefined : all.length),
  });

  const loaded = useMemo(() => feed.data?.pages.flat() ?? [], [feed.data]);

  const albums = loaded.filter((a) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      a.title.toLowerCase().includes(q) ||
      (a.description ?? "").toLowerCase().includes(q) ||
      a.photos.some((p) => (p.caption ?? "").toLowerCase().includes(q))
    );
  });

  const photoIds = useMemo(() => loaded.flatMap((a) => a.photos.map((p) => p.id)), [loaded]);

  const engagement = useQuery<Engagement>({
    queryKey: ["albums-engagement", familyId, photoIds.length],
    enabled: photoIds.length > 0,
    queryFn: async () => {
      const [r, c] = await Promise.all([
        supabase.from("photo_reactions").select("photo_id, user_id").in("photo_id", photoIds),
        supabase
          .from("photo_comments")
          .select("id, photo_id, content, author_id, reply_to, created_at")
          .in("photo_id", photoIds)
          .order("created_at", { ascending: true }),
      ]);
      if (r.error) throw r.error;
      if (c.error) throw c.error;

      const albumOf = new Map<string, string>();
      for (const a of loaded) for (const p of a.photos) albumOf.set(p.id, a.id);

      const likes = new Map<string, string[]>();
      for (const row of r.data ?? []) {
        const list = likes.get(row.photo_id) ?? [];
        list.push(row.user_id);
        likes.set(row.photo_id, list);
      }

      const comments = new Map<string, number>();
      const top = new Map<string, { top: CommentRow; reply: CommentRow | null }>();
      const likePhoto = new Map<string, string>();
      for (const row of (c.data ?? []) as CommentRow[]) {
        const albumId = albumOf.get(row.photo_id);
        if (!albumId) continue;
        comments.set(albumId, (comments.get(albumId) ?? 0) + 1);
        const existing = top.get(albumId);
        if (!existing) {
          if (!row.reply_to) {
            top.set(albumId, { top: row, reply: null });
            likePhoto.set(albumId, row.photo_id);
          }
        } else if (!existing.reply && existing.top.id === row.reply_to) {
          top.set(albumId, { top: existing.top, reply: row });
        }
      }
      return { likes, comments, top, likePhoto };
    },
  });

  // Infinite scroll.
  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && feed.hasNextPage && !feed.isFetchingNextPage) {
        void feed.fetchNextPage();
      }
    });
    io.observe(node);
    return () => io.disconnect();
  }, [feed.hasNextPage, feed.isFetchingNextPage, feed.fetchNextPage]);

  // Restore the reader's place after coming back from a memory.
  useEffect(() => {
    const saved = sessionStorage.getItem(SCROLL_KEY);
    if (saved && loaded.length > 0) {
      window.scrollTo({ top: Number(saved) });
      sessionStorage.removeItem(SCROLL_KEY);
    }
  }, [loaded.length]);

  const toggleLike = async (albumId: string, photoId: string, liked: boolean) => {
    if (!user || !familyId) return;
    if (liked) {
      const { error } = await supabase
        .from("photo_reactions")
        .delete()
        .eq("photo_id", photoId)
        .eq("user_id", user.id);
      if (error) toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("photo_reactions")
        .insert({ photo_id: photoId, family_id: familyId, user_id: user.id, emoji: "❤️" });
      if (error) toast.error(error.message);
    }
    void engagement.refetch();
  };

  const removeAlbum = async (id: string) => {
    const { error: err } = await supabase.from("albums").delete().eq("id", id);
    if (err) {
      toast.error(err.message);
      return;
    }
    toast.success("Memory deleted.");
    void queryClient.invalidateQueries({ queryKey: ["albums"] });
  };

  return (
    <AppShell title="Memories">
      <div className="space-y-4">
        <NewAlbumDialog />
        <Input
          placeholder="Search albums and captions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search memories"
        />
        {feed.isLoading && <LoadingBlock />}
        {feed.error && <ErrorState message="We couldn't load your memories." />}
        {!feed.isLoading && albums.length === 0 && (
          <EmptyState
            icon={<Images className="size-8" />}
            title={search.trim() ? "Nothing matched" : "No memories yet"}
            description={
              search.trim()
                ? "Try another word from a title or caption."
                : "Create your first album and start filling the family photobook."
            }
          />
        )}

        <div className="columns-2 gap-4 lg:columns-3 xl:columns-4">
          {albums.map((a) => (
            <MemoryCard
              key={a.id}
              album={a}
              engagement={engagement.data}
              onLike={(albumId, photoId, liked) => void toggleLike(albumId, photoId, liked)}
              onOpen={() => sessionStorage.setItem(SCROLL_KEY, String(window.scrollY))}
              canManage={a.created_by === user?.id || isAdmin}
              onDelete={() => void removeAlbum(a.id)}
            />
          ))}
        </div>

        <div ref={sentinel} aria-hidden className="h-8" />
        {feed.isFetchingNextPage && <LoadingBlock rows={1} />}
      </div>
    </AppShell>
  );
}
