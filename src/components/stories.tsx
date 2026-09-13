import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Eye, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useFamily, type Member } from "@/lib/family";
import { uploadFamilyImage, useSignedUrl } from "@/lib/media";
import { MemberAvatar } from "@/components/MemberAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type StoryRow = {
  id: string;
  family_id: string;
  user_id: string;
  url: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
  story_views: { user_id: string }[];
};

function useStories(familyId: string | null) {
  return useQuery({
    queryKey: ["stories", familyId],
    enabled: !!familyId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stories")
        .select("*, story_views(user_id)")
        .eq("family_id", familyId!)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as StoryRow[];
    },
  });
}

function name(members: Member[], id: string) {
  return members.find((m) => m.user_id === id)?.profile?.display_name ?? "Family member";
}
function avatar(members: Member[], id: string) {
  return members.find((m) => m.user_id === id)?.profile?.avatar_url ?? null;
}

function StoryViewer({
  stories,
  index,
  onClose,
  onIndexChange,
  onSaved,
}: {
  stories: StoryRow[];
  index: number | null;
  onClose: () => void;
  onIndexChange: (i: number) => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const { members, familyId, isAdmin } = useFamily();
  const story = index !== null ? stories[index] : undefined;
  const url = useSignedUrl(story?.url ?? null);
  const [saving, setSaving] = useState(false);

  const markViewed = async () => {
    if (!story || !user || !familyId || story.user_id === user.id) return;
    if (story.story_views.some((v) => v.user_id === user.id)) return;
    await supabase
      .from("story_views")
      .insert({ story_id: story.id, user_id: user.id, family_id: familyId });
  };
  if (story) void markViewed();

  const saveToAlbum = async () => {
    if (!story || !user || !familyId) return;
    setSaving(true);
    try {
      let albumId: string | null = null;
      const { data: existing } = await supabase
        .from("albums")
        .select("id")
        .eq("family_id", familyId)
        .eq("title", "Saved stories")
        .maybeSingle();
      if (existing) albumId = existing.id;
      else {
        const { data, error } = await supabase
          .from("albums")
          .insert({ family_id: familyId, created_by: user.id, title: "Saved stories" })
          .select("id")
          .single();
        if (error) throw error;
        albumId = data.id;
      }
      const { error: pErr } = await supabase.from("photos").insert({
        album_id: albumId,
        family_id: familyId,
        uploader_id: user.id,
        url: story.url,
        caption: story.caption,
      });
      if (pErr) throw pErr;
      toast.success("Saved to the “Saved stories” album.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save this story.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!story) return;
    const { error } = await supabase.from("stories").delete().eq("id", story.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Story removed.");
    onClose();
    onSaved();
  };

  return (
    <Dialog open={index !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md border-none bg-black/95 p-3 text-white">
        <DialogTitle className="sr-only">Family story</DialogTitle>
        <button
          aria-label="Close story"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-black/50 p-2"
        >
          <X className="size-5" />
        </button>
        {story && (
          <>
            <div className="flex items-center gap-2 pr-10">
              <MemberAvatar
                name={name(members, story.user_id)}
                avatarPath={avatar(members, story.user_id)}
                className="size-9"
              />
              <div>
                <p className="font-semibold">{name(members, story.user_id)}</p>
                <p className="text-xs opacity-75">
                  {formatDistanceToNow(new Date(story.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
            <div className="mt-2 flex min-h-[45vh] items-center justify-center">
              {url ? (
                <img src={url} alt={story.caption ?? "Family story"} className="max-h-[65vh] rounded-xl object-contain" />
              ) : (
                <p className="text-sm opacity-80">Loading…</p>
              )}
            </div>
            {story.caption && <p className="text-center text-sm opacity-90">{story.caption}</p>}
            <div className="mt-2 flex items-center gap-2">
              {story.user_id === user?.id && (
                <span className="flex items-center gap-1 text-sm opacity-80">
                  <Eye className="size-4" /> {story.story_views.length} seen
                </span>
              )}
              <button
                onClick={() => void saveToAlbum()}
                disabled={saving}
                className="ml-auto rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save to album"}
              </button>
              {(story.user_id === user?.id || isAdmin) && (
                <button
                  aria-label="Delete story"
                  onClick={() => void remove()}
                  className="rounded-full bg-white/15 p-2"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
            {stories.length > 1 && (
              <div className="mt-1 flex items-center justify-between text-sm">
                <button
                  disabled={index === 0}
                  onClick={() => onIndexChange(Math.max(0, (index ?? 0) - 1))}
                  className="rounded-full bg-white/15 px-3 py-1 font-semibold disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="opacity-80">
                  {(index ?? 0) + 1} / {stories.length}
                </span>
                <button
                  disabled={(index ?? 0) >= stories.length - 1}
                  onClick={() => onIndexChange(Math.min(stories.length - 1, (index ?? 0) + 1))}
                  className="rounded-full bg-white/15 px-3 py-1 font-semibold disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StoryThumb({ path }: { path: string }) {
  const url = useSignedUrl(path);
  return url ? (
    <img src={url} alt="" className="size-full rounded-full object-cover" />
  ) : (
    <div className="size-full rounded-full bg-muted" />
  );
}

export function StoryRow() {
  const { user } = useAuth();
  const { familyId, members } = useFamily();
  const queryClient = useQueryClient();
  const { data } = useStories(familyId);
  const [viewing, setViewing] = useState<number | null>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const stories = data ?? [];
  const groups = useMemo(() => {
    const byUser = new Map<string, StoryRow[]>();
    for (const s of stories) {
      const list = byUser.get(s.user_id) ?? [];
      list.push(s);
      byUser.set(s.user_id, list);
    }
    return Array.from(byUser.entries());
  }, [stories]);

  const share = async () => {
    if (!pending || !familyId || !user) return;
    setBusy(true);
    try {
      const path = await uploadFamilyImage(familyId, "stories", pending);
      const { error } = await supabase.from("stories").insert({
        family_id: familyId,
        user_id: user.id,
        url: path,
        caption: caption.trim() || null,
      });
      if (error) throw error;
      toast.success("Your story is live for 24 hours.");
      setPending(null);
      setCaption("");
      void queryClient.invalidateQueries({ queryKey: ["stories"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not share your story.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <section className="card-soft p-3" aria-label="Family stories">
      <div className="flex gap-4 overflow-x-auto pb-1">
        <button
          onClick={() => fileRef.current?.click()}
          className="flex w-16 shrink-0 flex-col items-center gap-1"
        >
          <span className="relative flex size-14 items-center justify-center rounded-full border-2 border-dashed border-primary">
            <Plus className="size-6 text-primary" />
          </span>
          <span className="text-xs">Your story</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label="Add a story photo"
          onChange={(e) => setPending(e.target.files?.[0] ?? null)}
        />

        {groups.map(([userId, list]) => {
          const first = list[0]!;
          const seen = list.every((s) => s.story_views.some((v) => v.user_id === user?.id)) ;
          const startIndex = stories.findIndex((s) => s.id === first.id);
          return (
            <button
              key={userId}
              onClick={() => setViewing(startIndex)}
              className="flex w-16 shrink-0 flex-col items-center gap-1"
            >
              <span
                className={`size-14 rounded-full p-[2px] ${
                  seen && userId !== user?.id ? "bg-border" : "bg-gradient-to-br from-rose to-primary"
                }`}
              >
                <span className="block size-full overflow-hidden rounded-full border-2 border-card">
                  <StoryThumb path={first.url} />
                </span>
              </span>
              <span className="w-16 truncate text-center text-xs">
                {userId === user?.id ? "You" : name(members, userId).split(" ")[0]}
              </span>
            </button>
          );
        })}
        {groups.length === 0 && (
          <p className="self-center text-sm text-muted-foreground">
            Share a photo that disappears after 24 hours.
          </p>
        )}
      </div>

      <Dialog open={!!pending} onOpenChange={(v) => !v && setPending(null)}>
        <DialogContent>
          <DialogTitle>Share a story</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Your photo stays visible to your family for 24 hours.
          </p>
          <Input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption (optional)"
            aria-label="Story caption"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button onClick={() => void share()} disabled={busy}>
              {busy ? "Sharing…" : "Share story"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <StoryViewer
        stories={stories}
        index={viewing}
        onClose={() => setViewing(null)}
        onIndexChange={setViewing}
        onSaved={() => void queryClient.invalidateQueries({ queryKey: ["stories"] })}
      />
    </section>
  );
}
