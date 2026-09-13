import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertTriangle, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/states";
import { useAuth } from "@/lib/auth";
import { logAdminAction, usePlatformAdmin } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Creator dashboard — Family Circle" },
      {
        name: "description",
        content: "Private platform overview: usage, reported content, account suspensions and the audit trail.",
      },
      { property: "og:title", content: "Creator dashboard — Family Circle" },
      { property: "og:description", content: "Platform metrics and moderation tools for the Family Circle creator." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function Metric({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="card-soft p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-display text-3xl">{value ?? "—"}</p>
    </div>
  );
}

function countOf(table: "profiles" | "families" | "posts" | "photos" | "content_reports") {
  return supabase.from(table).select("id", { count: "exact", head: true });
}

function AdminPage() {
  const { user } = useAuth();
  const { isPlatformAdmin, loading } = usePlatformAdmin();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");

  const metrics = useQuery({
    queryKey: ["admin-metrics"],
    enabled: isPlatformAdmin,
    queryFn: async () => {
      const [people, families, posts, photos, reports] = await Promise.all([
        countOf("profiles"),
        countOf("families"),
        countOf("posts"),
        countOf("photos"),
        countOf("content_reports"),
      ]);
      const openReports = await supabase
        .from("content_reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "open");
      const suspended = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .not("suspended_at", "is", null);
      return {
        people: people.count ?? 0,
        families: families.count ?? 0,
        posts: posts.count ?? 0,
        photos: photos.count ?? 0,
        reports: reports.count ?? 0,
        openReports: openReports.count ?? 0,
        suspended: suspended.count ?? 0,
      };
    },
  });

  const reports = useQuery({
    queryKey: ["admin-reports"],
    enabled: isPlatformAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const people = useQuery({
    queryKey: ["admin-people", search],
    enabled: isPlatformAdmin,
    queryFn: async () => {
      let q = supabase
        .from("profiles")
        .select("id, display_name, suspended_at, suspended_reason, created_at")
        .order("created_at", { ascending: false })
        .limit(25);
      if (search.trim()) q = q.ilike("display_name", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const audit = useQuery({
    queryKey: ["admin-audit"],
    enabled: isPlatformAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  const refreshAll = () => {
    for (const key of ["admin-metrics", "admin-reports", "admin-people", "admin-audit"]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  };

  const setSuspension = async (id: string, name: string | null, suspend: boolean) => {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({
        suspended_at: suspend ? new Date().toISOString() : null,
        suspended_reason: suspend ? reason.trim() || "No reason given" : null,
      })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAdminAction(user.id, suspend ? "suspend_account" : "restore_account", {
      type: "profile",
      id,
      details: { name, reason: reason.trim() || null },
    });
    toast.success(suspend ? "Account suspended." : "Account restored.");
    setReason("");
    refreshAll();
  };

  const resolveReport = async (id: string, status: "resolved" | "dismissed") => {
    if (!user) return;
    const { error } = await supabase
      .from("content_reports")
      .update({ status, resolved_at: new Date().toISOString(), resolved_by: user.id })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAdminAction(user.id, `report_${status}`, { type: "content_report", id });
    refreshAll();
  };

  if (loading) {
    return (
      <AppShell title="Creator dashboard">
        <LoadingBlock />
      </AppShell>
    );
  }

  if (!isPlatformAdmin) {
    return (
      <AppShell title="Creator dashboard">
        <EmptyState
          icon={<ShieldCheck className="size-8" />}
          title="This area is private"
          description="Only the platform creator can open the dashboard."
        />
        <div className="pt-4">
          <Button asChild variant="outline">
            <Link to="/">Back home</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Creator dashboard">
      <div className="space-y-6">
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="People" value={metrics.data?.people} />
          <Metric label="Families" value={metrics.data?.families} />
          <Metric label="Posts" value={metrics.data?.posts} />
          <Metric label="Photos & videos" value={metrics.data?.photos} />
          <Metric label="Reports" value={metrics.data?.reports} />
          <Metric label="Open reports" value={metrics.data?.openReports} />
          <Metric label="Suspended" value={metrics.data?.suspended} />
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl">Reported content</h2>
          {reports.isLoading && <LoadingBlock rows={2} />}
          {reports.error && <ErrorState message="We couldn't load the reports." />}
          {reports.data?.length === 0 && (
            <EmptyState
              icon={<AlertTriangle className="size-8" />}
              title="Nothing reported"
              description="Reports raised by family members will appear here."
            />
          )}
          {reports.data?.map((r) => (
            <div key={r.id} className="card-soft space-y-2 p-4">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-sage/50 px-2 py-0.5 text-xs font-semibold uppercase">
                  {r.status}
                </span>
                <span className="text-sm text-muted-foreground">
                  {r.target_type} · {format(new Date(r.created_at), "d MMM yyyy, HH:mm")}
                </span>
              </div>
              <p className="font-semibold">{r.reason}</p>
              {r.details && <p className="text-sm">{r.details}</p>}
              {r.status === "open" && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => void resolveReport(r.id, "resolved")}>
                    Mark resolved
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void resolveReport(r.id, "dismissed")}>
                    Dismiss
                  </Button>
                </div>
              )}
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl">Accounts</h2>
          <Input
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search accounts"
          />
          <Input
            placeholder="Reason for a suspension (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-label="Suspension reason"
          />
          {people.isLoading && <LoadingBlock rows={2} />}
          {people.error && <ErrorState message="We couldn't load the accounts." />}
          {people.data?.length === 0 && (
            <EmptyState icon={<Users className="size-8" />} title="No accounts found" description="Try another name." />
          )}
          {people.data?.map((p) => (
            <div key={p.id} className="card-soft flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.display_name ?? "Unnamed"}</p>
                <p className="text-sm text-muted-foreground">
                  {p.suspended_at
                    ? `Suspended ${format(new Date(p.suspended_at), "d MMM yyyy")}${
                        p.suspended_reason ? ` · ${p.suspended_reason}` : ""
                      }`
                    : `Joined ${format(new Date(p.created_at), "d MMM yyyy")}`}
                </p>
              </div>
              {p.id !== user?.id && (
                <Button
                  size="sm"
                  variant={p.suspended_at ? "outline" : "destructive"}
                  onClick={() => void setSuspension(p.id, p.display_name, !p.suspended_at)}
                >
                  {p.suspended_at ? "Restore" : "Suspend"}
                </Button>
              )}
            </div>
          ))}
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl">Audit log</h2>
          {audit.isLoading && <LoadingBlock rows={2} />}
          {audit.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">No moderation actions recorded yet.</p>
          )}
          <ul className="space-y-1.5">
            {audit.data?.map((a) => (
              <li key={a.id} className="card-soft p-3 text-sm">
                <span className="font-semibold">{a.action}</span>{" "}
                <span className="text-muted-foreground">
                  {a.target_type ?? ""} · {format(new Date(a.created_at), "d MMM yyyy, HH:mm")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
