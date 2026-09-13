import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Images, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { FamilyMedia } from "@/components/FamilyMedia";
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
        content: "Shared family photo albums: create an album, add captions and revisit favourites.",
      },
      { property: "og:title", content: "Memories — Family Circle" },
      { property: "og:description", content: "Your family photobook, kept private and safe." },
    ],
  }),
  component: MemoriesPage,
});

type AlbumRow = {
  id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  cover_url: string | null;
  created_by: string;
  created_at: string;
  photos: {
    id: string;
    url: string;
    caption: string | null;
    is_favorite: boolean;
    kind: string;
    duration_seconds: number | null;
    uploader_id: string;
  }[];
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
    if (!familyId || !user) return;
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
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setQueue((prev) => prev.map((q, idx) => (idx === i ? { ...q, status: "failed", error: message } : q)));
      }
    }
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
      await uploadInto(id, pendingIndexes);
      const stillFailed = queue.some((q) => q.status === "failed");
      void queryClient.invalidateQueries({ queryKey: ["albums"] });
      if (stillFailed) {
        toast.error("Some files didn't upload. Tap “Retry failed” to try again.");
        return;
      }
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
              <Button type="button" variant="outline" onClick={() => void retryFailed()} disabled={busy}>
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

function MemoriesPage() {
  const { familyId, isAdmin } = useFamily();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["albums", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("albums")
        .select("*, photos(id, url, caption, is_favorite, kind, duration_seconds, uploader_id)")
        .eq("family_id", familyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AlbumRow[];
    },
  });

  const albums = (data ?? []).filter(
    (a) =>
      !search.trim() ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      (a.description ?? "").toLowerCase().includes(search.toLowerCase()) ||
      a.photos.some((p) => (p.caption ?? "").toLowerCase().includes(search.toLowerCase())),
  );

  const removeAlbum = async (id: string) => {
    const { error: err } = await supabase.from("albums").delete().eq("id", id);
    if (err) {
      toast.error(err.message);
      return;
    }
    toast.success("Album deleted.");
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
        />
        {isLoading && <LoadingBlock />}
        {error && <ErrorState message="We couldn't load your albums." />}
        {!isLoading && albums.length === 0 && (
          <EmptyState
            icon={<Images className="size-8" />}
            title="No albums yet"
            description="Create your first album and start filling the family photobook."
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {albums.map((a) => (
            <div key={a.id} className="card-soft overflow-hidden">
              <Link to="/memories/$albumId" params={{ albumId: a.id }} className="block">
                {a.cover_url ? (
                  <FamilyMedia path={a.cover_url} kind="image" alt={a.title} className="h-44 w-full" />
                ) : (
                  <div className="flex h-44 items-center justify-center bg-muted text-muted-foreground">
                    <Images className="size-8" />
                  </div>
                )}
              </Link>
              <div className="p-4">
                <div className="flex items-start gap-2">
                  <Link
                    to="/memories/$albumId"
                    params={{ albumId: a.id }}
                    className="min-w-0 flex-1"
                  >
                    <h3 className="truncate font-display text-lg">{a.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {a.photos.length} photo{a.photos.length === 1 ? "" : "s"}
                      {a.event_date ? ` · ${format(new Date(a.event_date), "d MMM yyyy")}` : ""}
                    </p>
                  </Link>
                  {(a.created_by === user?.id || isAdmin) && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          aria-label="Delete album"
                          className="p-1.5 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this album?</AlertDialogTitle>
                          <AlertDialogDescription>
                            “{a.title}” and its {a.photos.length} photo
                            {a.photos.length === 1 ? "" : "s"} will be removed for everyone. This
                            cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep album</AlertDialogCancel>
                          <AlertDialogAction onClick={() => void removeAlbum(a.id)}>
                            Delete album
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
                {a.description && <p className="mt-2">{a.description}</p>}
                <Contributors ids={a.photos.map((p) => p.uploader_id)} />
                {a.photos.length > 1 && (
                  <div className="mt-3 grid grid-cols-3 gap-1">
                    {a.photos.slice(0, 6).map((p) => (
                      <FamilyMedia
                        key={p.id}
                        path={p.url}
                        kind={p.kind}
                        durationSeconds={p.duration_seconds}
                        alt={p.caption ?? "Family photo"}
                        className="aspect-square w-full rounded-md"
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
