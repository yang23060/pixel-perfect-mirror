import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import {
  Bell,
  CalendarDays,
  Home,
  Images,
  MessageCircle,
  Search,
  Settings,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useFamily } from "@/lib/family";
import { MemberAvatar } from "@/components/MemberAvatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/memories", label: "Memories", icon: Images },
  { to: "/chat", label: "Chat", icon: MessageCircle },
  { to: "/family", label: "Family", icon: Users },
] as const;

function useUnreadNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["unread-notifications", user?.id],
    enabled: !!user,
    refetchInterval: 30000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .is("read_at", null);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const { session, loading, profile, profileLoading, signOut } = useAuth();
  const { family, memberships, loading: familyLoading, setFamilyId } = useFamily();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const unread = useUnreadNotifications();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      void navigate({ to: "/auth", search: { next: pathname } });
      return;
    }
    if (profileLoading || familyLoading) return;
    const needsOnboarding = !profile?.onboarded || memberships.length === 0;
    if (needsOnboarding) void navigate({ to: "/onboarding" });
  }, [
    loading,
    session,
    profile,
    profileLoading,
    familyLoading,
    memberships.length,
    navigate,
    pathname,
  ]);

  if (loading || !session || profileLoading || familyLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <div className="md:flex">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-sidebar p-5 md:flex">
          <Link to="/" className="mb-8 block">
            <span className="font-display text-2xl font-semibold text-primary">Family Circle</span>
            <span className="mt-1 block text-sm text-muted-foreground">
              {family?.name ?? "Your family"}
            </span>
          </Link>
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => {
              const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-base font-semibold transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-sidebar-accent",
                  )}
                >
                  <item.icon className="size-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto flex flex-col gap-1 pt-6">
            <Link
              to="/search"
              className="flex items-center gap-3 rounded-xl px-4 py-3 font-semibold hover:bg-sidebar-accent"
            >
              <Search className="size-5" /> Search
            </Link>
            <Link
              to="/notifications"
              className="flex items-center gap-3 rounded-xl px-4 py-3 font-semibold hover:bg-sidebar-accent"
            >
              <Bell className="size-5" /> Notifications
              {(unread.data ?? 0) > 0 && (
                <span className="ml-auto rounded-full bg-rose px-2 py-0.5 text-xs text-rose-foreground">
                  {unread.data}
                </span>
              )}
            </Link>
            <Link
              to="/settings"
              className="flex items-center gap-3 rounded-xl px-4 py-3 font-semibold hover:bg-sidebar-accent"
            >
              <Settings className="size-5" /> Settings
            </Link>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
            <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <h1 className="truncate font-display text-xl font-semibold md:text-2xl">
                  {title ?? family?.name ?? "Family Circle"}
                </h1>
              </div>
              <Button variant="ghost" size="icon" asChild className="md:hidden">
                <Link to="/search" aria-label="Search">
                  <Search className="size-5" />
                </Link>
              </Button>
              <Button variant="ghost" size="icon" asChild className="relative md:hidden">
                <Link to="/notifications" aria-label="Notifications">
                  <Bell className="size-5" />
                  {(unread.data ?? 0) > 0 && (
                    <span className="absolute right-1 top-1 size-2.5 rounded-full bg-rose" />
                  )}
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger aria-label="Your account">
                  <MemberAvatar
                    name={profile?.display_name ?? null}
                    avatarPath={profile?.avatar_url ?? null}
                    className="size-10"
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel className="truncate">
                    {profile?.display_name || "You"}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {memberships.length > 1 && (
                    <>
                      <DropdownMenuLabel className="text-xs uppercase text-muted-foreground">
                        Your families
                      </DropdownMenuLabel>
                      {memberships.map((m) => (
                        <DropdownMenuItem
                          key={m.family_id}
                          onClick={() => setFamilyId(m.family_id)}
                          className={cn(m.family_id === family?.id && "font-semibold")}
                        >
                          {m.families?.name}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={() => void navigate({ to: "/settings" })}>
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void navigate({ to: "/onboarding" })}>
                    Join or create a family
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={async () => {
                      await signOut();
                      void navigate({ to: "/auth", search: { next: "/" } });
                    }}
                  >
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card/95 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-lg">
          {NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-semibold",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <item.icon className={cn("size-6", active && "scale-110")} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
