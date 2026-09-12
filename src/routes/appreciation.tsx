import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { HeartHandshake, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { MemberAvatar } from "@/components/MemberAvatar";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/states";
import { useAuth } from "@/lib/auth";
import { useFamily } from "@/lib/family";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/appreciation")({
  head: () => ({
    meta: [
      { title: "Appreciation wall — Family Circle" },
      {
        name: "description",
        content: "Leave a short thank-you note for someone in your family on the appreciation wall.",
      },
      { property: "og:title", content: "Appreciation wall — Family Circle" },
      { property: "og:description", content: "Small notes of thanks for the people you love." },
    ],
  }),
  component: AppreciationPage,
});

function AppreciationPage() {
  const { familyId, members, isAdmin } = useFamily();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [to, setTo] = useState("everyone");
  const [busy, setBusy] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["appreciations", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appreciations")
        .select("*")
        .eq("family_id", familyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !familyId || !user) return;
    if (!message.trim()) {
      toast.error("Write a short note first.");
      return;
    }
    setBusy(true);
    const { error: insertError } = await supabase.from("appreciations").insert({
      family_id: familyId,
      author_id: user.id,
      to_user_id: to === "everyone" ? null : to,
      message: message.trim(),
    });
    if (!insertError && to !== "everyone") {
      await supabase.from("notifications").insert({
        family_id: familyId,
        user_id: to,
        actor_id: user.id,
        type: "appreciation",
        title: "Someone appreciated you",
        body: message.trim().slice(0, 120),
        link: "/appreciation",
      });
    }
    setBusy(false);
    if (insertError) {
      toast.error(insertError.message);
      return;
    }
    setMessage("");
    setTo("everyone");
    toast.success("Your note is on the wall.");
    void queryClient.invalidateQueries({ queryKey: ["appreciations"] });
  };

  const name = (id: string | null) =>
    id
      ? (members.find((m) => m.user_id === id)?.profile?.display_name ?? "Family member")
      : "everyone";

  return (
    <AppShell title="Appreciation wall">
      <div className="space-y-4">
        <form onSubmit={submit} className="card-soft space-y-3 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="to">Who is this for?</Label>
            <Select value={to} onValueChange={setTo}>
              <SelectTrigger id="to">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="everyone">Everyone</SelectItem>
                {members
                  .filter((m) => m.user_id !== user?.id)
                  .map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.profile?.display_name ?? "Family member"}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note">Your note</Label>
            <Textarea
              id="note"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Thank you for…"
            />
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Sharing…" : "Add to the wall"}
          </Button>
        </form>

        {isLoading && <LoadingBlock />}
        {error && <ErrorState message="We couldn't load the wall." />}
        {!isLoading && (data?.length ?? 0) === 0 && (
          <EmptyState
            icon={<HeartHandshake className="size-8" />}
            title="The wall is empty"
            description="Be the first to thank someone in your family."
          />
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {data?.map((a) => {
            const author = members.find((m) => m.user_id === a.author_id)?.profile;
            return (
              <div key={a.id} className="rounded-2xl bg-accent p-4 text-accent-foreground shadow-soft">
                <div className="flex items-center gap-2">
                  <MemberAvatar
                    name={author?.display_name ?? null}
                    avatarPath={author?.avatar_url ?? null}
                    className="size-9"
                  />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-semibold">
                      {author?.display_name ?? "Family member"} → {name(a.to_user_id)}
                    </p>
                    <p className="opacity-70">
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {(a.author_id === user?.id || isAdmin) && (
                    <button
                      aria-label="Delete note"
                      onClick={async () => {
                        const { error: delError } = await supabase
                          .from("appreciations")
                          .delete()
                          .eq("id", a.id);
                        if (delError) toast.error(delError.message);
                        else void queryClient.invalidateQueries({ queryKey: ["appreciations"] });
                      }}
                      className="p-1 opacity-70 hover:opacity-100"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-[1.05rem]">{a.message}</p>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
