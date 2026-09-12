import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/states";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Family Circle" },
      {
        name: "description",
        content: "Comments, reactions, mentions, event invitations and birthday reminders in one list.",
      },
      { property: "og:title", content: "Notifications — Family Circle" },
      { property: "og:description", content: "Everything you missed in your family space." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const markAll = async () => {
    const { error: err } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user!.id)
      .is("read_at", null);
    if (err) {
      toast.error(err.message);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    void queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
  };

  const markOne = async (id: string) => {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    void queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
  };

  const unread = (data ?? []).filter((n) => !n.read_at).length;

  return (
    <AppShell title="Notifications">
      <div className="space-y-4">
        {unread > 0 && (
          <Button variant="outline" onClick={() => void markAll()} className="w-full">
            Mark all {unread} as read
          </Button>
        )}
        {isLoading && <LoadingBlock />}
        {error && <ErrorState message="We couldn't load your notifications." />}
        {!isLoading && (data?.length ?? 0) === 0 && (
          <EmptyState
            icon={<Bell className="size-8" />}
            title="Nothing new"
            description="Comments, reactions, invitations and reminders will show up here."
          />
        )}
        <ul className="space-y-2">
          {data?.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => void markOne(n.id)}
                className={`card-soft w-full p-4 text-left ${!n.read_at ? "border-primary/40 bg-sage/20" : ""}`}
              >
                <p className="font-semibold">{n.title}</p>
                {n.body && <p className="text-muted-foreground">{n.body}</p>}
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  {!n.read_at ? " · new" : ""}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
