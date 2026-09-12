import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { MemberAvatar } from "@/components/MemberAvatar";
import { EmptyState, LoadingBlock } from "@/components/states";
import { useAuth } from "@/lib/auth";
import { useFamily } from "@/lib/family";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export const Route = createFileRoute("/family")({
  head: () => ({
    meta: [
      { title: "Family directory — Family Circle" },
      {
        name: "description",
        content: "See everyone in your family space: relationships, birthdays and shared details.",
      },
      { property: "og:title", content: "Family directory — Family Circle" },
      { property: "og:description", content: "Everyone in your family, in one warm directory." },
    ],
  }),
  component: FamilyPage,
});

function FamilyPage() {
  const { members, membersLoading, isAdmin, refresh } = useFamily();
  const { user } = useAuth();

  const removeMember = async (id: string) => {
    const { error } = await supabase.from("family_members").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Member removed.");
    refresh();
  };

  if (membersLoading) {
    return (
      <AppShell title="Family">
        <LoadingBlock />
      </AppShell>
    );
  }

  return (
    <AppShell title="Family">
      {members.length === 0 ? (
        <EmptyState icon={<Users className="size-8" />} title="No members yet" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {members.map((m) => {
            const p = m.profile;
            const isChild = m.role === "child";
            return (
              <div key={m.id} className="card-soft p-4">
                <div className="flex items-center gap-3">
                  <MemberAvatar
                    name={p?.display_name ?? null}
                    avatarPath={p?.avatar_url ?? null}
                    className="size-14"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p?.display_name ?? "Family member"}</p>
                    <p className="text-sm text-muted-foreground">
                      {m.relationship ?? "Family"}
                      {p?.birthday && !isChild ? ` · ${format(new Date(p.birthday), "d MMM")}` : ""}
                    </p>
                  </div>
                  {m.role === "admin" && <Badge>Admin</Badge>}
                  {isChild && <Badge variant="secondary">Child</Badge>}
                </div>
                {p?.bio && <p className="mt-3 text-[1.02rem]">{p.bio}</p>}
                {p?.favorite_things && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Loves: {p.favorite_things}
                  </p>
                )}
                {p?.timezone && !isChild && (
                  <p className="mt-1 text-sm text-muted-foreground">Time zone: {p.timezone}</p>
                )}
                {p?.share_contact && !isChild && (p.contact_email || p.contact_phone) && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {[p.contact_email, p.contact_phone].filter(Boolean).join(" · ")}
                  </p>
                )}
                {isAdmin && m.user_id !== user?.id && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="mt-3">
                        Remove from family
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Remove {p?.display_name ?? "this member"}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          They will lose access to this family space. Their posts stay unless you
                          delete them.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep member</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void removeMember(m.id)}>
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
