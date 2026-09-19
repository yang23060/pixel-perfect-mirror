import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { Heart, ImagePlus, MapPin, MessageCircle, MoreHorizontal, Plus, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useFamily, type Member } from "@/lib/family";
import { uploadFamilyMedia } from "@/lib/media";
import { FamilyMedia, MediaLightbox, useLightbox } from "@/components/FamilyMedia";
import { MemberAvatar } from "@/components/MemberAvatar";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const POST_TYPES = [
  { value: "update", label: "General update" },
  { value: "celebration", label: "Celebration" },
  { value: "question", label: "Question" },
  { value: "announcement", label: "Family announcement" },
  { value: "appreciation", label: "Appreciation" },
  { value: "memory", label: "Memory from the past" },
] as const;

export type PostTypeValue = (typeof POST_TYPES)[number]["value"];

const MOODS = ["Happy", "Grateful", "Excited", "Cozy", "Tired", "Missing you"];
export const REACTIONS = ["❤️", "😂", "🎉", "🙏", "🤗", "👍"];

export type PostMedia = {
  id: string;
  url: string;
  kind: string;
  duration_seconds: number | null;
  position: number;
  uploader_id: string;
};

export type PostRow = {
  id: string;
  family_id: string;
  author_id: string;
  content: string;
  post_type: string;
  mood: string | null;
  title: string | null;
  event_date: string | null;
  location: string | null;
  is_highlight: boolean;
  created_at: string;
  post_media: PostMedia[];
  comments: { id: string; author_id: string; content: string; created_at: string }[];
  reactions: { id: string; user_id: string; emoji: string }[];
  post_mentions: { user_id: string }[];
};

export function usePosts(familyId: string | null, options?: { highlightsOnly?: boolean }) {
  return useQuery({
    queryKey: ["posts", familyId, options?.highlightsOnly ?? false],
    enabled: !!familyId,
    queryFn: async () => {
      let q = supabase
        .from("posts")
        .select("*, post_media(*), comments(*), reactions(*), post_mentions(user_id)")
        .eq("family_id", familyId!)
        .order("created_at", { ascending: false })
        .limit(60);
      if (options?.highlightsOnly) q = q.eq("is_highlight", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as PostRow[];
    },
  });
}

function memberName(members: Member[], id: string) {
  return members.find((m) => m.user_id === id)?.profile?.display_name ?? "Family member";
}
function memberAvatar(members: Member[], id: string) {
  return members.find((m) => m.user_id === id)?.profile?.avatar_url ?? null;
}

export function PostComposer() {
  const { user } = useAuth();
  const { familyId, members } = useFamily();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [postType, setPostType] = useState("update");
  const [mood, setMood] = useState("none");
  const [files, setFiles] = useState<File[]>([]);
  const [mentions, setMentions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [uploaded, setUploaded] = useState(0);

  const create = useMutation({
    mutationFn: async () => {
      if (!familyId || !user) throw new Error("No family selected");
      if (!content.trim() && !title.trim() && files.length === 0)
        throw new Error("Write something or add a photo first.");
      const { data, error } = await supabase
        .from("posts")
        .insert({
          family_id: familyId,
          author_id: user.id,
          content: content.trim(),
          title: title.trim() || null,
          event_date: eventDate || null,
          location: location.trim() || null,
          post_type: postType as PostTypeValue,
          mood: mood === "none" ? null : mood,
        })
        .select("id")
        .single();
      if (error) throw error;
      const postId = data.id;
      setUploaded(0);
      for (let i = 0; i < files.length; i++) {
        const media = await uploadFamilyMedia(familyId, "posts", files[i]!);
        const { error: mErr } = await supabase.from("post_media").insert({
          post_id: postId,
          family_id: familyId,
          uploader_id: user.id,
          url: media.path,
          kind: media.kind,
          duration_seconds: media.duration,
          position: i,
        });
        if (mErr) throw mErr;
        setUploaded(i + 1);
      }
      if (mentions.length) {
        await supabase
          .from("post_mentions")
          .insert(mentions.map((m) => ({ post_id: postId, user_id: m, family_id: familyId })));
        await supabase.from("notifications").insert(
          mentions.map((m) => ({
            family_id: familyId,
            user_id: m,
            actor_id: user.id,
            type: "mention",
            title: "You were mentioned in a post",
            body: (title || content).trim().slice(0, 120),
            link: "/",
          })),
        );
      }
      if (postType === "announcement") {
        const others = members.filter((m) => m.user_id !== user.id);
        if (others.length) {
          await supabase.from("notifications").insert(
            others.map((m) => ({
              family_id: familyId,
              user_id: m.user_id,
              actor_id: user.id,
              type: "announcement",
              title: "New family announcement",
              body: (title || content).trim().slice(0, 120),
              link: "/",
            })),
          );
        }
      }
    },
    onSuccess: () => {
      setContent("");
      setTitle("");
      setEventDate("");
      setLocation("");
      setFiles([]);
      setMentions([]);
      setMood("none");
      setPostType("update");
      setOpen(false);
      setUploaded(0);
      toast.success("Shared with your family.");
      void queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not post."),
  });

  return (
    <div className="card-soft p-4">
      <div className="flex gap-3">
        <MemberAvatar
          name={memberName(members, user?.id ?? "")}
          avatarPath={memberAvatar(members, user?.id ?? "")}
        />
        <Textarea
          value={content}
          onFocus={() => setOpen(true)}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share a moment with your family…"
          className="min-h-[52px] flex-1 resize-none bg-muted/50 text-base"
        />
      </div>

      {open && (
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-semibold" htmlFor="post-title">
              Moment title (optional)
            </label>
            <Input
              id="post-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Grandma's birthday dinner 🎂"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold" htmlFor="post-date">
                When
              </label>
              <Input
                id="post-date"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold" htmlFor="post-place">
                Where
              </label>
              <Input
                id="post-place"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Taipei"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Select value={postType} onValueChange={setPostType}>
              <SelectTrigger aria-label="Post type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POST_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={mood} onValueChange={setMood}>
              <SelectTrigger aria-label="Mood or activity">
                <SelectValue placeholder="Mood (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No mood</SelectItem>
                {MOODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold" htmlFor="post-media">
              Photos & videos
            </label>
            <Input
              id="post-media"
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            {files.length > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                {files.length} file(s) selected
                {create.isPending ? ` · uploading ${uploaded}/${files.length}` : ""}
              </p>
            )}
          </div>

          <div>
            <span className="mb-1 block text-sm font-semibold">Mention family</span>
            <div className="flex flex-wrap gap-2">
              {members
                .filter((m) => m.user_id !== user?.id)
                .map((m) => {
                  const on = mentions.includes(m.user_id);
                  return (
                    <button
                      key={m.user_id}
                      type="button"
                      onClick={() =>
                        setMentions((prev) =>
                          on ? prev.filter((x) => x !== m.user_id) : [...prev, m.user_id],
                        )
                      }
                      className={`rounded-full border px-3 py-1 text-sm ${
                        on ? "border-primary bg-sage/50 font-semibold" : "border-border"
                      }`}
                    >
                      {m.profile?.display_name ?? "Family member"}
                    </button>
                  );
                })}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setContent("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending ? "Sharing…" : "Share"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Collage: one large tile plus two stacked tiles, with +N on the last. */
function MomentCollage({
  media,
  onOpen,
}: {
  media: PostMedia[];
  onOpen: (index: number) => void;
}) {
  if (media.length === 0) return null;
  if (media.length === 1) {
    const first = media[0]!;
    return (
      <FamilyMedia
        path={first.url}
        kind={first.kind}
        durationSeconds={first.duration_seconds}
        alt="Family moment"
        onClick={() => onOpen(0)}
        className="mt-3 h-64 w-full rounded-2xl sm:h-80"
      />
    );
  }
  const [first, second, third] = media;
  const extra = media.length - 3;
  return (
    <div className="mt-3 grid h-64 grid-cols-3 gap-1.5 sm:h-80">
      <FamilyMedia
        path={first!.url}
        kind={first!.kind}
        durationSeconds={first!.duration_seconds}
        alt="Family moment"
        onClick={() => onOpen(0)}
        className="col-span-2 h-full rounded-l-2xl"
      />
      <div className="grid h-full grid-rows-2 gap-1.5">
        <FamilyMedia
          path={second!.url}
          kind={second!.kind}
          durationSeconds={second!.duration_seconds}
          alt="Family moment"
          onClick={() => onOpen(1)}
          className="h-full rounded-tr-2xl"
        />
        {third ? (
          <div className="relative h-full">
            <FamilyMedia
              path={third.url}
              kind={third.kind}
              alt="Family moment"
              onClick={() => onOpen(2)}
              className="h-full rounded-br-2xl"
            />
            {extra > 0 && (
              <button
                onClick={() => onOpen(2)}
                className="absolute inset-0 flex items-center justify-center rounded-br-2xl bg-black/50 text-xl font-semibold text-white"
                aria-label={`View ${extra} more`}
              >
                +{extra}
              </button>
            )}
          </div>
        ) : (
          <div className="h-full rounded-br-2xl bg-muted" />
        )}
      </div>
    </div>
  );
}

function Contributors({ ids, members }: { ids: string[]; members: Member[] }) {
  if (ids.length === 0) return null;
  return (
    <div className="mt-3 flex items-center gap-2">
      <div className="flex -space-x-2">
        {ids.slice(0, 4).map((id) => (
          <MemberAvatar
            key={id}
            name={memberName(members, id)}
            avatarPath={memberAvatar(members, id)}
            className="size-8 border-2 border-card"
          />
        ))}
      </div>
      <span className="text-sm text-muted-foreground">
        {ids.length} contributor{ids.length === 1 ? "" : "s"}
      </span>
    </div>
  );
}

export function PostCard({ post }: { post: PostRow }) {
  const { user } = useAuth();
  const { members, isAdmin, familyId } = useFamily();
  const queryClient = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.content);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [adding, setAdding] = useState(false);
  const addRef = useRef<HTMLInputElement | null>(null);
  const lightbox = useLightbox();

  const mine = post.author_id === user?.id;
  const canManage = mine || isAdmin;
  const myReaction = post.reactions.find((r) => r.user_id === user?.id);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["posts"] });

  const media = [...post.post_media].sort(
    (a, b) => a.position - b.position || a.id.localeCompare(b.id),
  );
  const contributorIds = Array.from(new Set([post.author_id, ...media.map((m) => m.uploader_id)]));

  const addYours = async (files: File[]) => {
    if (!user || !familyId || files.length === 0) return;
    setAdding(true);
    try {
      let position = media.length;
      for (const file of files) {
        const up = await uploadFamilyMedia(post.family_id, "posts", file);
        const { error } = await supabase.from("post_media").insert({
          post_id: post.id,
          family_id: post.family_id,
          uploader_id: user.id,
          url: up.path,
          kind: up.kind,
          duration_seconds: up.duration,
          position: position++,
        });
        if (error) throw error;
      }
      if (post.author_id !== user.id) {
        await supabase.from("notifications").insert({
          family_id: post.family_id,
          user_id: post.author_id,
          actor_id: user.id,
          type: "post_media",
          title: "Someone added photos to your moment",
          body: post.title ?? post.content.slice(0, 120),
          link: "/",
        });
      }
      toast.success("Added to this moment.");
      void invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add your photos.");
    } finally {
      setAdding(false);
      if (addRef.current) addRef.current.value = "";
    }
  };

  const react = async (emoji: string) => {
    if (!user) return;
    try {
      if (myReaction?.emoji === emoji) {
        const { error } = await supabase.from("reactions").delete().eq("id", myReaction.id);
        if (error) throw error;
      } else if (myReaction) {
        const { error } = await supabase
          .from("reactions")
          .update({ emoji })
          .eq("id", myReaction.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("reactions").insert({
          post_id: post.id,
          family_id: post.family_id,
          user_id: user.id,
          emoji,
        });
        if (error) throw error;
        if (post.author_id !== user.id) {
          await supabase.from("notifications").insert({
            family_id: post.family_id,
            user_id: post.author_id,
            actor_id: user.id,
            type: "reaction",
            title: "Someone reacted to your post",
            body: emoji,
            link: "/",
          });
        }
      }
      void invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save your reaction.");
    }
  };

  const addComment = async () => {
    if (!user || !commentText.trim()) return;
    const { error } = await supabase.from("comments").insert({
      post_id: post.id,
      family_id: post.family_id,
      author_id: user.id,
      content: commentText.trim(),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    if (post.author_id !== user.id) {
      await supabase.from("notifications").insert({
        family_id: post.family_id,
        user_id: post.author_id,
        actor_id: user.id,
        type: "comment",
        title: "New comment on your post",
        body: commentText.trim().slice(0, 120),
        link: "/",
      });
    }
    setCommentText("");
    void invalidate();
  };

  const saveEdit = async () => {
    if (!draft.trim()) return;
    const { error } = await supabase.from("posts").update({ content: draft.trim() }).eq("id", post.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEditing(false);
    toast.success("Post updated.");
    void invalidate();
  };

  const remove = async () => {
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Post deleted.");
    void invalidate();
  };

  const toggleHighlight = async () => {
    const { error } = await supabase
      .from("posts")
      .update({ is_highlight: !post.is_highlight })
      .eq("id", post.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void invalidate();
  };

  const typeLabel = POST_TYPES.find((t) => t.value === post.post_type)?.label ?? "Update";
  const totalReactions = post.reactions.length;
  const when = post.event_date ? format(new Date(`${post.event_date}T12:00:00`), "EEEE, MMMM d") : null;

  return (
    <article className="card-soft p-4">
      <header className="flex items-start gap-3">
        <MemberAvatar
          name={memberName(members, post.author_id)}
          avatarPath={memberAvatar(members, post.author_id)}
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{memberName(members, post.author_id)}</p>
          <p className="text-sm text-muted-foreground">
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            {post.mood ? ` · feeling ${post.mood.toLowerCase()}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {post.post_type !== "update" && <Badge variant="secondary">{typeLabel}</Badge>}
          {post.is_highlight && <Star className="size-4 fill-rose text-rose" />}
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="Post options" className="rounded-full p-1.5 hover:bg-muted">
              <MoreHorizontal className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={toggleHighlight}>
                {post.is_highlight ? "Remove from highlights" : "Save as family highlight"}
              </DropdownMenuItem>
              {mine && <DropdownMenuItem onClick={() => setEditing(true)}>Edit post</DropdownMenuItem>}
              {canManage && (
                <DropdownMenuItem onClick={() => setConfirmDelete(true)} className="text-destructive">
                  Delete post
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <MomentCollage media={media} onOpen={lightbox.open} />

      {post.title && <h3 className="mt-3 font-display text-xl leading-snug">{post.title}</h3>}
      {(when || post.location) && (
        <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
          {post.location && <MapPin className="size-3.5" />}
          {[when, post.location].filter(Boolean).join(" · ")}
        </p>
      )}

      {editing ? (
        <div className="mt-3 space-y-2">
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button onClick={saveEdit}>Save</Button>
          </div>
        </div>
      ) : (
        post.content && (
          <p className="mt-2 whitespace-pre-wrap text-[1.05rem] leading-relaxed">{post.content}</p>
        )
      )}

      {post.post_mentions.length > 0 && (
        <p className="mt-2 text-sm text-primary">
          with {post.post_mentions.map((m) => memberName(members, m.user_id)).join(", ")}
        </p>
      )}

      {media.length > 0 && <Contributors ids={contributorIds} members={members} />}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {REACTIONS.map((emoji) => {
          const count = post.reactions.filter((r) => r.emoji === emoji).length;
          const active = myReaction?.emoji === emoji;
          return (
            <button
              key={emoji}
              onClick={() => void react(emoji)}
              className={`rounded-full border px-2.5 py-1 text-base transition ${
                active ? "border-rose bg-accent" : "border-border hover:bg-muted"
              }`}
              aria-label={`React ${emoji}`}
            >
              {emoji}
              {count > 0 && <span className="ml-1 text-sm font-semibold">{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-4 border-t border-border pt-3 text-muted-foreground">
        <span className="flex items-center gap-1.5 font-semibold">
          <Heart className={`size-4 ${totalReactions ? "fill-rose text-rose" : ""}`} /> {totalReactions}
        </span>
        <button
          onClick={() => setShowComments((v) => !v)}
          className="flex items-center gap-1.5 font-semibold hover:text-foreground"
        >
          <MessageCircle className="size-4" /> {post.comments.length}
        </button>
        <button
          onClick={() => addRef.current?.click()}
          disabled={adding}
          className="ml-auto flex items-center gap-1 rounded-full border border-border px-3 py-1 font-semibold text-foreground hover:bg-muted disabled:opacity-60"
        >
          <Plus className="size-4" /> {adding ? "Adding…" : "Add yours"}
        </button>
        <input
          ref={addRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          aria-label="Add your photos to this moment"
          onChange={(e) => void addYours(Array.from(e.target.files ?? []))}
        />
      </div>

      {showComments && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {post.comments.length === 0 && (
            <p className="text-sm text-muted-foreground">No comments yet — be the first.</p>
          )}
          {[...post.comments]
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .map((c) => (
              <div key={c.id} className="flex items-start gap-2.5">
                <MemberAvatar
                  name={memberName(members, c.author_id)}
                  avatarPath={memberAvatar(members, c.author_id)}
                  className="size-9"
                />
                <div className="flex-1 rounded-2xl bg-muted px-3 py-2">
                  <p className="text-sm font-semibold">{memberName(members, c.author_id)}</p>
                  <p className="whitespace-pre-wrap">{c.content}</p>
                </div>
                {(c.author_id === user?.id || isAdmin) && (
                  <button
                    aria-label="Delete comment"
                    onClick={async () => {
                      const { error } = await supabase.from("comments").delete().eq("id", c.id);
                      if (error) toast.error(error.message);
                      else void invalidate();
                    }}
                    className="p-1.5 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            ))}
          <div className="flex gap-2">
            <Input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment…"
              onKeyDown={(e) => {
                if (e.key === "Enter") void addComment();
              }}
            />
            <Button onClick={() => void addComment()} disabled={!commentText.trim()}>
              Post
            </Button>
          </div>
        </div>
      )}

      <MediaLightbox
        items={media}
        index={lightbox.index}
        onClose={lightbox.close}
        onIndexChange={lightbox.setIndex}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              The post, its photos and comments will be removed for everyone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep post</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}

type AlbumFeedRow = {
  id: string;
  family_id: string;
  created_by: string;
  title: string;
  description: string | null;
  event_date: string | null;
  created_at: string;
  photos: {
    id: string;
    url: string;
    kind: string;
    duration_seconds: number | null;
    position: number | null;
  }[];
};

function useFamilyAlbums(familyId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["feed-albums", familyId],
    enabled: !!familyId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("albums")
        .select("id, family_id, created_by, title, description, event_date, created_at, photos(id, url, kind, duration_seconds, position)")
        .eq("family_id", familyId!)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as unknown as AlbumFeedRow[];
    },
  });
}

function AlbumFeedCard({ album }: { album: AlbumFeedRow }) {
  const { members } = useFamily();
  const photos = [...album.photos].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );
  const shown = photos.slice(0, 4);
  return (
    <article className="card-soft overflow-hidden">
      <div className="flex items-center gap-3 p-4 pb-3">
        <MemberAvatar
          name={memberName(members, album.created_by)}
          avatarPath={memberAvatar(members, album.created_by)}
        />
        <div className="min-w-0">
          <p className="truncate font-semibold">{memberName(members, album.created_by)}</p>
          <p className="text-sm text-muted-foreground">
            shared a moment ·{" "}
            {formatDistanceToNow(new Date(album.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>

      <Link to="/memories/$albumId" params={{ albumId: album.id }} className="block">
        <div className="px-4 pb-3">
          <p className="font-semibold">{album.title}</p>
          {album.description && (
            <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed">
              {album.description}
            </p>
          )}
          {album.event_date && (
            <p className="mt-1 text-sm text-muted-foreground">
              {format(new Date(album.event_date), "d MMM yyyy")}
            </p>
          )}
        </div>
        {shown.length > 0 && (
          <div className={shown.length === 1 ? "" : "grid grid-cols-2 gap-1"}>
            {shown.map((p) => (
              <FamilyMedia
                key={p.id}
                path={p.url}
                kind={p.kind}
                durationSeconds={p.duration_seconds}
                alt={album.title}
                thumbWidth={640}
                className={shown.length === 1 ? "max-h-[420px] w-full" : "aspect-square w-full"}
              />
            ))}
          </div>
        )}
        <p className="p-4 text-sm font-semibold text-primary">
          {photos.length > shown.length
            ? `View album · ${photos.length} photos`
            : "View album"}
        </p>
      </Link>
    </article>
  );
}

export function PostFeed({ highlightsOnly = false }: { highlightsOnly?: boolean }) {
  const { familyId } = useFamily();
  const { data, isLoading, error } = usePosts(familyId, { highlightsOnly });
  const albums = useFamilyAlbums(familyId, !highlightsOnly);

  if (isLoading || albums.isLoading) return <LoadingBlock />;
  if (error) return <ErrorState message="We couldn't load the family feed." />;
  const items = [
    ...(data ?? []).map((post) => ({ kind: "post" as const, at: post.created_at, post })),
    ...(albums.data ?? []).map((album) => ({
      kind: "album" as const,
      at: album.created_at,
      album,
    })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Heart className="size-8" />}
        title={highlightsOnly ? "No highlights yet" : "Nothing shared yet"}
        description={
          highlightsOnly
            ? "Save a post as a family highlight and it will appear here."
            : "Be the first to share news, a photo or a memory with your family."
        }
      />
    );
  }
  return (
    <div className="space-y-4">
      {items.map((item) =>
        item.kind === "post" ? (
          <PostCard key={item.post.id} post={item.post} />
        ) : (
          <AlbumFeedCard key={item.album.id} album={item.album} />
        ),
      )}
    </div>
  );
}

export { ImagePlus, X };
