import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Trash2, Vote } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/states";
import { useAuth } from "@/lib/auth";
import { useFamily } from "@/lib/family";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/polls")({
  head: () => ({
    meta: [
      { title: "Family polls — Family Circle" },
      {
        name: "description",
        content: "Ask the family a question, collect votes and see the results together.",
      },
      { property: "og:title", content: "Family polls — Family Circle" },
      { property: "og:description", content: "Decide things together with quick family polls." },
    ],
  }),
  component: PollsPage,
});

type PollRow = {
  id: string;
  family_id: string;
  created_by: string;
  question: string;
  expires_at: string | null;
  created_at: string;
  poll_options: { id: string; label: string; position: number }[];
  poll_votes: { user_id: string; option_id: string }[];
};

function NewPollDialog() {
  const { familyId } = useFamily();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [expires, setExpires] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !familyId || !user) return;
    const clean = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || clean.length < 2) {
      toast.error("Add a question and at least two choices.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("polls")
        .insert({
          family_id: familyId,
          created_by: user.id,
          question: question.trim(),
          expires_at: expires ? new Date(expires).toISOString() : null,
        })
        .select("id")
        .single();
      if (error) throw error;
      const { error: optErr } = await supabase.from("poll_options").insert(
        clean.map((label, i) => ({
          poll_id: data.id,
          family_id: familyId,
          label,
          position: i,
        })),
      );
      if (optErr) throw optErr;
      toast.success("Poll created.");
      setOpen(false);
      setQuestion("");
      setOptions(["", ""]);
      setExpires("");
      void queryClient.invalidateQueries({ queryKey: ["polls"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the poll.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg">
          <Vote className="mr-2 size-5" /> New poll
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ask the family</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="q">Question</Label>
            <Input id="q" value={question} onChange={(e) => setQuestion(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Choices</Label>
            {options.map((o, i) => (
              <Input
                key={i}
                value={o}
                placeholder={`Choice ${i + 1}`}
                onChange={(e) =>
                  setOptions((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)))
                }
              />
            ))}
            <Button type="button" variant="ghost" onClick={() => setOptions((p) => [...p, ""])}>
              Add another choice
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exp">Closes on (optional)</Label>
            <Input
              id="exp"
              type="datetime-local"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Creating…" : "Create poll"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PollCard({ poll }: { poll: PollRow }) {
  const { user } = useAuth();
  const { isAdmin, members } = useFamily();
  const queryClient = useQueryClient();
  const myVote = poll.poll_votes.find((v) => v.user_id === user?.id);
  const total = poll.poll_votes.length;
  const closed = poll.expires_at ? new Date(poll.expires_at) < new Date() : false;

  const vote = async (optionId: string) => {
    if (!user || closed) return;
    const payload = {
      poll_id: poll.id,
      option_id: optionId,
      user_id: user.id,
      family_id: poll.family_id,
    };
    const { error } = myVote
      ? await supabase
          .from("poll_votes")
          .update({ option_id: optionId })
          .eq("poll_id", poll.id)
          .eq("user_id", user.id)
      : await supabase.from("poll_votes").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["polls"] });
  };

  const remove = async () => {
    const { error } = await supabase.from("polls").delete().eq("id", poll.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["polls"] });
  };

  return (
    <article className="card-soft p-4">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <h3 className="font-display text-lg">{poll.question}</h3>
          <p className="text-sm text-muted-foreground">
            by{" "}
            {members.find((m) => m.user_id === poll.created_by)?.profile?.display_name ??
              "Family member"}
            {poll.expires_at
              ? ` · ${closed ? "closed" : "closes"} ${format(new Date(poll.expires_at), "d MMM")}`
              : ""}
          </p>
        </div>
        {(poll.created_by === user?.id || isAdmin) && (
          <button
            aria-label="Delete poll"
            onClick={() => void remove()}
            className="p-1.5 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
      <div className="mt-3 space-y-2">
        {[...poll.poll_options]
          .sort((a, b) => a.position - b.position)
          .map((opt) => {
            const count = poll.poll_votes.filter((v) => v.option_id === opt.id).length;
            const pct = total ? Math.round((count / total) * 100) : 0;
            const mine = myVote?.option_id === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => void vote(opt.id)}
                disabled={closed}
                className={`w-full rounded-xl border p-3 text-left ${
                  mine ? "border-primary bg-sage/40" : "border-border hover:bg-muted"
                } ${closed ? "opacity-70" : ""}`}
              >
                <div className="flex justify-between font-semibold">
                  <span>{opt.label}</span>
                  <span>
                    {count} · {pct}%
                  </span>
                </div>
                <Progress value={pct} className="mt-2" />
              </button>
            );
          })}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {total} vote{total === 1 ? "" : "s"}
      </p>
    </article>
  );
}

function PollsPage() {
  const { familyId } = useFamily();
  const { data, isLoading, error } = useQuery({
    queryKey: ["polls", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("polls")
        .select("*, poll_options(*), poll_votes(user_id, option_id)")
        .eq("family_id", familyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PollRow[];
    },
  });

  return (
    <AppShell title="Family polls">
      <div className="space-y-4">
        <NewPollDialog />
        {isLoading && <LoadingBlock />}
        {error && <ErrorState message="We couldn't load the polls." />}
        {!isLoading && (data?.length ?? 0) === 0 && (
          <EmptyState
            icon={<Vote className="size-8" />}
            title="No polls yet"
            description="Ask the family where to meet, what to cook, or when to gather."
          />
        )}
        {data?.map((p) => <PollCard key={p.id} poll={p} />)}
      </div>
    </AppShell>
  );
}
