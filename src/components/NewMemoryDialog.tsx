import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Images } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useFamily } from "@/lib/family";
import { uploadFamilyMedia, validateMedia } from "@/lib/media";
import { shareMemoryToChat } from "@/lib/chat-share";
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

type QueuedFile = {
  file: File;
  status: "waiting" | "uploading" | "done" | "failed";
  error?: string;
  path?: string;
};

/**
 * The single posting flow for memories. Used by the Memories page and by
 * "Share the moment" on Home so both create the same album.
 */
export function NewMemoryDialog({ triggerLabel = "New album" }: { triggerLabel?: string }) {
  const { familyId, members } = useFamily();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [coverIndex, setCoverIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [albumId, setAlbumId] = useState<string | null>(null);

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

  const uploadInto = async (album: string, indexes: number[]) => {
    const uploaded: { path: string; kind: string }[] = [];
    if (!familyId || !user) return uploaded;
    for (const i of indexes) {
      const item = queue[i];
      if (!item) continue;
      setQueue((prev) => prev.map((q, idx) => (idx === i ? { ...q, status: "uploading" } : q)));
      try {
        const up = await uploadFamilyMedia(familyId, "albums", item.file);
        const { error } = await supabase.from("photos").insert({
          album_id: album,
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
          await supabase.from("albums").update({ cover_url: up.path }).eq("id", album);
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

  /** Tell the rest of the family a new memory was posted. */
  const notifyFamily = async (album: string, albumTitle: string) => {
    if (!familyId || !user) return;
    const others = members.filter((m) => m.user_id !== user.id);
    if (!others.length) return;
    await supabase.from("notifications").insert(
      others.map((m) => ({
        family_id: familyId,
        user_id: m.user_id,
        actor_id: user.id,
        type: "album",
        title: "New memory posted",
        body: albumTitle.slice(0, 120),
        link: `/memories/${album}`,
      })),
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !familyId || !user) return;
    if (!title.trim()) {
      toast.error("Give your memory a title.");
      return;
    }
    setBusy(true);
    try {
      let id = albumId;
      let isNew = false;
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
        isNew = true;
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
      if (isNew) await notifyFamily(id, title.trim());
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Shared with your family.");
      setOpen(false);
      setTitle("");
      setDescription("");
      setDate("");
      setQueue([]);
      setAlbumId(null);
      setCoverIndex(0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not share the memory.");
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
          <Images className="mr-2 size-5" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Share a memory</DialogTitle>
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
              {busy ? "Saving…" : "Share memory"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
