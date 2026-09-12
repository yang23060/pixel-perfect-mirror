import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Images, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { FamilyImage } from "@/components/FamilyImage";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/states";
import { useAuth } from "@/lib/auth";
import { useFamily } from "@/lib/family";
import { uploadFamilyImage } from "@/lib/media";
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

export const Route = createFileRoute("/memories")({
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
  photos: { id: string; url: string; caption: string | null; is_favorite: boolean }[];
};

function NewAlbumDialog() {
  const { familyId } = useFamily();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !familyId || !user) return;
    if (!title.trim()) {
      toast.error("Give your album a title.");
      return;
    }
    setBusy(true);
    try {
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
      let cover: string | null = null;
      for (let i = 0; i < files.length; i++) {
        const path = await uploadFamilyImage(familyId, "albums", files[i]!);
        if (!cover) cover = path;
        const { error: pErr } = await supabase.from("photos").insert({
          album_id: data.id,
          family_id: familyId,
          uploader_id: user.id,
          url: path,
        });
        if (pErr) throw pErr;
        setProgress(Math.round(((i + 1) / files.length) * 100));
      }
      if (cover) await supabase.from("albums").update({ cover_url: cover }).eq("id", data.id);
      toast.success("Album created.");
      setOpen(false);
      setTitle("");
      setDescription("");
      setDate("");
      setFiles([]);
      setProgress(0);
      void queryClient.invalidateQueries({ queryKey: ["albums"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the album.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg">
          <Images className="mr-2 size-5" /> New album
        </Button>
      </DialogTrigger>
      <DialogContent>
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
            <Label htmlFor="al-photos">Photos</Label>
            <Input
              id="al-photos"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            {busy && files.length > 0 && (
              <p className="text-sm text-muted-foreground">Uploading… {progress}%</p>
            )}
          </div>
          <DialogFooter>
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
        .select("*, photos(id, url, caption, is_favorite)")
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
              {a.cover_url ? (
                <FamilyImage path={a.cover_url} alt={a.title} className="h-44 w-full" />
              ) : (
                <div className="flex h-44 items-center justify-center bg-muted text-muted-foreground">
                  <Images className="size-8" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-display text-lg">{a.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {a.photos.length} photo{a.photos.length === 1 ? "" : "s"}
                      {a.event_date ? ` · ${format(new Date(a.event_date), "d MMM yyyy")}` : ""}
                    </p>
                  </div>
                  {(a.created_by === user?.id || isAdmin) && (
                    <button
                      aria-label="Delete album"
                      onClick={() => void removeAlbum(a.id)}
                      className="p-1.5 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
                {a.description && <p className="mt-2">{a.description}</p>}
                {a.photos.length > 1 && (
                  <div className="mt-3 grid grid-cols-3 gap-1.5">
                    {a.photos.slice(0, 6).map((p) => (
                      <FamilyImage
                        key={p.id}
                        path={p.url}
                        alt={p.caption ?? "Family photo"}
                        className="aspect-square w-full rounded-lg"
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
