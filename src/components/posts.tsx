import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Heart, ImagePlus, MessageCircle, MoreHorizontal, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useFamily, type Member } from "@/lib/family";
import { uploadFamilyImage } from "@/lib/media";
import { FamilyImage } from "@/components/FamilyImage";
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

export type PostRow = {
  id: string;
  family_id: string;
  author_id: string;
  content: string;
  post_type: string;
  mood: string | null;
  is_highlight: boolean;
  created_at: string;
  post_images: { id: string; url: string; position: number }[];
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
        .select("*, post_images(*), comments(*), reactions(*), post_mentions(user_id)")
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
  const [postType, setPostType] = useState("update");
  const [mood, setMood] = useState("none");
  const [files, setFiles] = useState<File[]>([]);
  const [mentions, setMentions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  const create = useMutation({
    mutationFn: async () => {
      if (!familyId || !user) throw new Error("No family selected");
      if (!content.trim()) throw new Error("Write something first.");
      const { data, error } = await supabase
        .from("posts")
        .insert({
          family_id: familyId,
          author_id: user.id,
          content: content.trim(),
          post_type: postType as PostTypeValue,
          mood: mood === "none" ? null : mood,
        })
        .select("id")
        .single();
      if (error) throw error;
      const postId = data.id;
      for (let i = 0; i < files.length; i++) {
        const path = await uploadFamilyImage(familyId, "posts", files[i]!);
        const { error: imgErr } = await supabase
          .from("post_images")
          .insert({ post_id: postId, family_id: familyId, url: path, position: i });
        if (imgErr) throw imgErr;
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
            body: content.trim().slice(0, 120),
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
              body: content.trim().slice(0, 120),
              link: "/",
            })),
          );
        }
      }
    },
    onSuccess: () => {
      setContent("");
      setFiles([]);
      setMentions([]);
      setMood("none");
      setPostType("update");
      setOpen(false);
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
          placeholder="Share something with your family…"
          className="min-h-[52px] flex-1 resize-none bg-muted/50 text-base"
        />
      </div>

      {open && (
        <div className="mt-4 space-y-3">
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
            <label className="mb-1 block text-sm font-semibold">Photos</label>
            <Input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            {files.length > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">{files.length} photo(s) selected</p>
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

export function PostCard({ post }: { post: PostRow }) {
  const { user } = useAuth();
  const { members, isAdmin } = useFamily();
  const queryClient = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.content);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const mine = post.author_id === user?.id;
  const canManage = mine || isAdmin;
  const myReaction = post.reactions.find((r) => r.user_id === user?.id);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["posts"] });

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
        <p className="mt-3 whitespace-pre-wrap text-[1.05rem] leading-relaxed">{post.content}</p>
      )}

      {post.post_mentions.length > 0 && (
        <p className="mt-2 text-sm text-primary">
          with {post.post_mentions.map((m) => memberName(members, m.user_id)).join(", ")}
        </p>
      )}

      {post.post_images.length > 0 && (
        <div
          className={`mt-3 grid gap-2 ${post.post_images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
        >
          {[...post.post_images]
            .sort((a, b) => a.position - b.position)
            .map((img) => (
              <FamilyImage
                key={img.id}
                path={img.url}
                alt="Family photo"
                className="h-48 w-full rounded-xl sm:h-60"
              />
            ))}
        </div>
      )}

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
        <button
          onClick={() => setShowComments((v) => !v)}
          className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold text-muted-foreground hover:bg-muted"
        >
          <MessageCircle className="size-4" /> {post.comments.length}
        </button>
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

export function PostFeed({ highlightsOnly = false }: { highlightsOnly?: boolean }) {
  const { familyId } = useFamily();
  const { data, isLoading, error } = usePosts(familyId, { highlightsOnly });

  if (isLoading) return <LoadingBlock />;
  if (error) return <ErrorState message="We couldn't load the family feed." />;
  if (!data || data.length === 0) {
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
      {data.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}

export { ImagePlus, X };
