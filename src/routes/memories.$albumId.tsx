import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, Flag, Heart, ImagePlus, Images, MessageCircle, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { FamilyMedia } from "@/components/FamilyMedia";
import { MemberAvatar } from "@/components/MemberAvatar";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/states";
import { useAuth } from "@/lib/auth";
import { useFamily } from "@/lib/family";
import { uploadFamilyMedia } from "@/lib/media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
      { title: "Album — Family Circle" },
      {
        name: "description",
        content: "Browse this family album in a photo grid, react, comment and add your own photos.",
      },
      { property: "og:title", content: "Family album — Family Circle" },
      {
        property: "og:description",
        content: "Photos, videos, reactions and comments from a shared family album.",
      },
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

function PhotoViewer({
  photo,
  album,
  onClose,
  onChanged,
}: {
  photo: Photo;
  album: Album;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const { familyId, isAdmin, members } = useFamily();
  const [caption, setCaption] = useState(photo.caption ?? "");
  const [comment, setComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canManage = photo.uploader_id === user?.id || album.created_by === user?.id || isAdmin;

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
    toast.success("Photo removed.");
    onChanged();
    onClose();
  };

  const report = async () => {
    if (!user) return;
    const { error } = await supabase.from("content_reports").insert({
      family_id: album.family_id,
      reporter_id: user.id,
      target_type: "photo",
      target_id: photo.id,
      target_user_id: photo.uploader_id,
      reason: "Reported from an album",
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
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogTitle className="sr-only">Photo</DialogTitle>
        <FamilyMedia
          path={photo.url}
          kind={photo.kind}
          durationSeconds={photo.duration_seconds}
          alt={photo.caption ?? "Family photo"}
          className="max-h-[52vh] w-full rounded-xl"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={myReaction ? "default" : "outline"}
            size="sm"
            onClick={() => void toggleReaction()}
            aria-label={myReaction ? "Remove your heart" : "Add a heart"}
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
            {photo.is_favorite ? "Favourite" : "Favourite"}
          </Button>
          <p className="ml-auto text-sm text-muted-foreground">
            Added by {nameFor(photo.uploader_id)}
          </p>
          <Button variant="ghost" size="icon" aria-label="Report photo" onClick={() => void report()}>
            <Flag className="size-4" />
          </Button>
          {canManage && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Delete photo">
                  <Trash2 className="size-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove this photo?</AlertDialogTitle>
                  <AlertDialogDescription>
                    It will disappear from the album for everyone. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep photo</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void removePhoto()}>
                    Remove photo
                  </AlertDialogAction>
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
              aria-label="Photo caption"
            />
            <Button onClick={() => void saveCaption()} disabled={busy}>
              Save
            </Button>
          </div>
        ) : (
          photo.caption && <p>{photo.caption}</p>
        )}

        <div className="space-y-3">
          <h4 className="font-display text-lg">Comments</h4>
          {comments.isLoading && <LoadingBlock rows={1} />}
          {comments.data?.length === 0 && (
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
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{nameFor(c.author_id)}</p>
                  <p className="break-words">{c.content}</p>
                  <button
                    type="button"
                    className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                    onClick={() => setReplyTo(c.id)}
                  >
                    Reply
                  </button>
                </div>
              </div>
              {repliesFor(c.id).map((r) => (
                <div key={r.id} className="flex gap-3 pl-8">
                  <MemberAvatar
                    name={nameFor(r.author_id)}
                    avatarPath={avatarFor(r.author_id)}
                    className="size-7"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{nameFor(r.author_id)}</p>
                    <p className="break-words">{r.content}</p>
                  </div>
                </div>
              ))}
            </div>
          ))}
          {replyTarget && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              Replying to {nameFor(replyTarget.author_id)}
              <button
                type="button"
                className="font-semibold underline"
                onClick={() => setReplyTo(null)}
              >
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
      </DialogContent>
    </Dialog>
  );
}

function AlbumPage() {
  const { albumId } = Route.useParams();
  const { familyId, members } = useFamily();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [openPhoto, setOpenPhoto] = useState<string | null>(null);
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

  const photoIds = (data?.photos ?? []).map((p) => p.id);

  const engagement = useQuery({
    queryKey: ["album-engagement", albumId, photoIds.length],
    enabled: photoIds.length > 0,
    queryFn: async () => {
      const [r, c] = await Promise.all([
        supabase.from("photo_reactions").select("photo_id").in("photo_id", photoIds),
        supabase.from("photo_comments").select("photo_id").in("photo_id", photoIds),
      ]);
      if (r.error) throw r.error;
      if (c.error) throw c.error;
      const reactions = new Map<string, number>();
      for (const row of r.data ?? [])
        reactions.set(row.photo_id, (reactions.get(row.photo_id) ?? 0) + 1);
      const comments = new Map<string, number>();
      for (const row of c.data ?? [])
        comments.set(row.photo_id, (comments.get(row.photo_id) ?? 0) + 1);
      return { reactions, comments };
    },
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["album", albumId] });
    void queryClient.invalidateQueries({ queryKey: ["album-engagement", albumId] });
    void queryClient.invalidateQueries({ queryKey: ["albums"] });
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length || !familyId || !user) return;
    setUploading(true);
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
        });
        if (pErr) throw pErr;
      }
      toast.success(files.length === 1 ? "Photo added." : "Photos added.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add the photos.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const allPhotos = (data?.photos ?? [])
    .slice()
    .sort(
      (a, b) =>
        (a.position ?? 0) - (b.position ?? 0) ||
        a.created_at.localeCompare(b.created_at) ||
        a.id.localeCompare(b.id),
    );
  const photos = allPhotos.filter((p) => !favouritesOnly || p.is_favorite);
  const current = photos.find((p) => p.id === openPhoto) ?? null;

  const contributorIds = Array.from(new Set(allPhotos.map((p) => p.uploader_id)));
  const contributors = contributorIds.map((id) => ({
    id,
    name: members.find((m) => m.user_id === id)?.profile?.display_name ?? "Family member",
    avatar: members.find((m) => m.user_id === id)?.profile?.avatar_url ?? null,
  }));

  return (
    <AppShell title={data?.title ?? "Album"}>
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/memories">
            <ArrowLeft className="mr-2 size-4" /> All albums
          </Link>
        </Button>

        {isLoading && <LoadingBlock />}
        {error && <ErrorState message="We couldn't load this album." />}
        {!isLoading && !error && !data && (
          <EmptyState
            icon={<Images className="size-8" />}
            title="Album not found"
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
              </p>
              {data.description && <p className="mt-2">{data.description}</p>}
              {contributors.length > 0 && (
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {contributors.slice(0, 4).map((c) => (
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
                aria-label="Add photos"
                onChange={(e) => void addPhotos(e.target.files)}
              />
              <Button
                variant={favouritesOnly ? "default" : "outline"}
                onClick={() => setFavouritesOnly((v) => !v)}
              >
                <Star className={cn("mr-2 size-4", favouritesOnly && "fill-current")} />
                Favourites
              </Button>
            </div>

            {photos.length === 0 ? (
              <EmptyState
                icon={<Images className="size-8" />}
                title={favouritesOnly ? "No favourites yet" : "No photos yet"}
                description={
                  favouritesOnly
                    ? "Open a photo and tap the star to keep it here."
                    : "Add the first photos to this album."
                }
              />
            ) : (
              <div className="-mx-4 grid grid-cols-3 gap-0.5 sm:mx-0 sm:gap-1">
                {photos.map((p) => {
                  const hearts = engagement.data?.reactions.get(p.id) ?? 0;
                  const said = engagement.data?.comments.get(p.id) ?? 0;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setOpenPhoto(p.id)}
                      className="group relative aspect-square overflow-hidden sm:rounded-md"
                      aria-label={p.caption ?? "Open photo"}
                    >
                      <FamilyMedia
                        path={p.url}
                        kind={p.kind}
                        durationSeconds={p.duration_seconds}
                        alt={p.caption ?? "Family photo"}
                        className="size-full"
                      />
                      {p.is_favorite && (
                        <Star className="absolute right-1.5 top-1.5 size-4 fill-rose text-rose" />
                      )}
                      {(hearts > 0 || said > 0) && (
                        <span className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/60 to-transparent px-2 py-1 text-xs font-semibold text-white">
                          {hearts > 0 && (
                            <span className="flex items-center gap-1">
                              <Heart className="size-3 fill-current" />
                              {hearts}
                            </span>
                          )}
                          {said > 0 && (
                            <span className="flex items-center gap-1">
                              <MessageCircle className="size-3" />
                              {said}
                            </span>
                          )}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {current && data && (
          <PhotoViewer
            photo={current}
            album={data}
            onClose={() => setOpenPhoto(null)}
            onChanged={refresh}
          />
        )}
      </div>
    </AppShell>
  );
}
