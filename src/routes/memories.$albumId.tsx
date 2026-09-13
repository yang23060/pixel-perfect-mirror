import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, Heart, ImagePlus, Images, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { FamilyImage } from "@/components/FamilyImage";
import { MemberAvatar } from "@/components/MemberAvatar";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/states";
import { useAuth } from "@/lib/auth";
import { useFamily } from "@/lib/family";
import { uploadFamilyImage } from "@/lib/media";
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
        content: "Browse the photos in this family album, add captions and mark favourites.",
      },
      { property: "og:title", content: "Family album — Family Circle" },
      {
        property: "og:description",
        content: "Photos, captions and favourites from a shared family album.",
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
  uploader_id: string;
  taken_at: string | null;
  created_at: string;
};

type Album = {
  id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  cover_url: string | null;
  created_by: string;
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
  const [busy, setBusy] = useState(false);
  const canManage = photo.uploader_id === user?.id || album.created_by === user?.id || isAdmin;

  const comments = useQuery({
    queryKey: ["photo-comments", photo.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("photo_comments")
        .select("id, content, author_id, created_at")
        .eq("photo_id", photo.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

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

  const addComment = async () => {
    if (!comment.trim() || !user || !familyId) return;
    setBusy(true);
    const { error } = await supabase.from("photo_comments").insert({
      photo_id: photo.id,
      family_id: familyId,
      author_id: user.id,
      content: comment.trim(),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setComment("");
    void comments.refetch();
  };

  const nameFor = (id: string) =>
    members.find((m) => m.user_id === id)?.profile?.display_name ?? "Family member";
  const avatarFor = (id: string) =>
    members.find((m) => m.user_id === id)?.profile?.avatar_url ?? null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogTitle className="sr-only">Photo</DialogTitle>
        <FamilyImage
          path={photo.url}
          alt={photo.caption ?? "Family photo"}
          className="max-h-[52vh] w-full rounded-xl"
        />
        <div className="flex items-center gap-2">
          <Button
            variant={photo.is_favorite ? "default" : "outline"}
            size="sm"
            onClick={() => void toggleFavorite()}
            aria-label={photo.is_favorite ? "Remove from favourites" : "Mark as favourite"}
          >
            <Heart className={cn("mr-2 size-4", photo.is_favorite && "fill-current")} />
            {photo.is_favorite ? "Favourite" : "Add to favourites"}
          </Button>
          <p className="ml-auto text-sm text-muted-foreground">
            Added by {nameFor(photo.uploader_id)}
          </p>
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
          {comments.data?.map((c) => (
            <div key={c.id} className="flex gap-3">
              <MemberAvatar
                name={nameFor(c.author_id)}
                avatarPath={avatarFor(c.author_id)}
                className="size-9"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold">{nameFor(c.author_id)}</p>
                <p className="break-words">{c.content}</p>
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Write a comment…"
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
  const { familyId } = useFamily();
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
          "id, title, description, event_date, cover_url, created_by, photos(id, url, caption, is_favorite, uploader_id, taken_at, created_at)",
        )
        .eq("id", albumId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as (Album & { photos: Photo[] }) | null;
    },
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["album", albumId] });
    void queryClient.invalidateQueries({ queryKey: ["albums"] });
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length || !familyId || !user) return;
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const path = await uploadFamilyImage(familyId, "albums", files[i]!);
        const { error: pErr } = await supabase.from("photos").insert({
          album_id: albumId,
          family_id: familyId,
          uploader_id: user.id,
          url: path,
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

  const photos = (data?.photos ?? [])
    .filter((p) => !favouritesOnly || p.is_favorite)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const current = photos.find((p) => p.id === openPhoto) ?? null;

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
              {data.event_date && (
                <p className="text-sm text-muted-foreground">
                  {format(new Date(data.event_date), "d MMMM yyyy")}
                </p>
              )}
              {data.description && <p className="mt-2">{data.description}</p>}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => fileInput.current?.click()} disabled={uploading}>
                <ImagePlus className="mr-2 size-5" />
                {uploading ? "Adding…" : "Add photos"}
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                aria-label="Add photos"
                onChange={(e) => void addPhotos(e.target.files)}
              />
              <Button
                variant={favouritesOnly ? "default" : "outline"}
                onClick={() => setFavouritesOnly((v) => !v)}
              >
                <Heart className={cn("mr-2 size-4", favouritesOnly && "fill-current")} />
                Favourites
              </Button>
            </div>

            {photos.length === 0 ? (
              <EmptyState
                icon={<Images className="size-8" />}
                title={favouritesOnly ? "No favourites yet" : "No photos yet"}
                description={
                  favouritesOnly
                    ? "Open a photo and tap the heart to keep it here."
                    : "Add the first photos to this album."
                }
              />
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {photos.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setOpenPhoto(p.id)}
                    className="relative overflow-hidden rounded-xl"
                    aria-label={p.caption ?? "Open photo"}
                  >
                    <FamilyImage
                      path={p.url}
                      alt={p.caption ?? "Family photo"}
                      className="aspect-square w-full"
                    />
                    {p.is_favorite && (
                      <Heart className="absolute right-2 top-2 size-5 fill-rose text-rose" />
                    )}
                  </button>
                ))}
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
