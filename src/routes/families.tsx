import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { FamilyImage } from "@/components/FamilyImage";
import { EmptyState, LoadingBlock } from "@/components/states";
import { useFamily } from "@/lib/family";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/families")({
  head: () => ({
    meta: [
      { title: "My Families — Family Circle" },
      {
        name: "description",
        content:
          "See every family circle you belong to, switch between them, or join and create another.",
      },
      { property: "og:title", content: "My Families — Family Circle" },
      {
        property: "og:description",
        content: "Switch between your family circles or start a new one.",
      },
    ],
  }),
  component: FamiliesPage,
});

function FamiliesPage() {
  const { memberships, loading, familyId, setFamilyId } = useFamily();
  const navigate = useNavigate();

  const counts = useQuery({
    queryKey: ["family-member-counts", memberships.map((m) => m.family_id).join(",")],
    enabled: memberships.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_members")
        .select("family_id")
        .in(
          "family_id",
          memberships.map((m) => m.family_id),
        );
      if (error) throw error;
      const map = new Map<string, number>();
      for (const row of data ?? []) {
        map.set(row.family_id, (map.get(row.family_id) ?? 0) + 1);
      }
      return map;
    },
  });

  return (
    <AppShell title="My Families">
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Switch between the families you belong to. Everything — posts, photos, chat and the
          calendar — stays inside the family you pick.
        </p>

        {loading ? (
          <LoadingBlock />
        ) : memberships.length === 0 ? (
          <EmptyState
            title="No families yet"
            description="Create a family circle or join one with an invitation code."
          />
        ) : (
          <ul className="space-y-3">
            {memberships.map((m) => {
              const isActive = m.family_id === familyId;
              const count = counts.data?.get(m.family_id);
              return (
                <li
                  key={m.family_id}
                  className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="size-14 shrink-0 overflow-hidden rounded-2xl bg-muted">
                    {m.families?.cover_url ? (
                      <FamilyImage
                        path={m.families.cover_url}
                        alt={m.families?.name ?? "Family cover"}
                        className="size-14 object-cover"
                      />
                    ) : (
                      <div className="flex size-14 items-center justify-center text-muted-foreground">
                        <Users className="size-6" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-display text-lg font-semibold">
                        {m.families?.name ?? "Family"}
                      </p>
                      {isActive && <Badge>Current</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {m.relationship ? `${m.relationship} · ` : ""}
                      {m.role === "admin" ? "Admin" : m.role === "child" ? "Child" : "Adult"}
                      {count ? ` · ${count} ${count === 1 ? "member" : "members"}` : ""}
                    </p>
                  </div>
                  {isActive ? (
                    <Check className="size-5 text-primary" aria-label="Current family" />
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setFamilyId(m.family_id);
                        toast.success(`Switched to ${m.families?.name ?? "family"}`);
                        void navigate({ to: "/" });
                      }}
                    >
                      Switch
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <Button
          variant="outline"
          className="w-full"
          onClick={() => void navigate({ to: "/onboarding", search: { code: "" } })}
        >
          <Plus className="mr-2 size-4" /> Join or create another family
        </Button>
      </div>
    </AppShell>
  );
}
