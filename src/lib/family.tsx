import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type Profile } from "@/lib/auth";

export type FamilyRole = "admin" | "adult" | "child";

export type Family = {
  id: string;
  name: string;
  cover_url: string | null;
  created_by: string;
  created_at: string;
};

export type Membership = {
  id: string;
  family_id: string;
  user_id: string;
  role: FamilyRole;
  relationship: string | null;
  joined_at: string;
  families: Family | null;
};

export type Member = Membership & { profile: Profile | null };

type FamilyContextValue = {
  memberships: Membership[];
  loading: boolean;
  family: Family | null;
  familyId: string | null;
  role: FamilyRole | null;
  isAdmin: boolean;
  members: Member[];
  membersLoading: boolean;
  setFamilyId: (id: string) => void;
  refresh: () => void;
};

const FamilyContext = createContext<FamilyContextValue | null>(null);
const STORAGE_KEY = "family-circle:current-family";

export function FamilyProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [currentId, setCurrentId] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) setCurrentId(stored);
  }, []);

  // The saved choice on the account wins when this device has no preference yet.
  useEffect(() => {
    if (!currentId && profile?.active_family_id) setCurrentId(profile.active_family_id);
  }, [currentId, profile?.active_family_id]);

  const membershipQuery = useQuery({
    queryKey: ["memberships", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_members")
        .select("*, families(*)")
        .eq("user_id", user!.id)
        .order("joined_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Membership[];
    },
  });

  const memberships = membershipQuery.data ?? [];
  const active =
    memberships.find((m) => m.family_id === currentId) ?? memberships[0] ?? null;
  const familyId = active?.family_id ?? null;

  const membersQuery = useQuery({
    queryKey: ["members", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_members")
        .select("*, families(*)")
        .eq("family_id", familyId!);
      if (error) throw error;
      const rows = (data ?? []) as unknown as Membership[];
      const ids = rows.map((r) => r.user_id);
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("*")
        .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      if (pErr) throw pErr;
      const byId = new Map((profiles ?? []).map((p) => [p.id, p as Profile]));
      return rows
        .map((r) => ({ ...r, profile: byId.get(r.user_id) ?? null }))
        .sort((a, b) =>
          (a.profile?.display_name ?? "").localeCompare(b.profile?.display_name ?? ""),
        ) as Member[];
    },
  });

  const value = useMemo<FamilyContextValue>(
    () => ({
      memberships,
      loading: membershipQuery.isLoading,
      family: active?.families ?? null,
      familyId,
      role: active?.role ?? null,
      isAdmin: active?.role === "admin",
      members: membersQuery.data ?? [],
      membersLoading: membersQuery.isLoading,
      setFamilyId: (id: string) => {
        if (id === familyId) return;
        window.localStorage.setItem(STORAGE_KEY, id);
        setCurrentId(id);
        // Drop the previous family's cached content so nothing bleeds across.
        queryClient.removeQueries({
          predicate: (q) => {
            const key = q.queryKey[0];
            return key !== "profile" && key !== "memberships";
          },
        });
        if (user) {
          void supabase
            .from("profiles")
            .update({ active_family_id: id })
            .eq("id", user.id)
            .then(() => queryClient.invalidateQueries({ queryKey: ["profile"] }));
        }
      },
      refresh: () => {
        void membershipQuery.refetch();
        void membersQuery.refetch();
      },
    }),
    [memberships, membershipQuery, membersQuery, active, familyId, queryClient, user],
  );

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export function useFamily() {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error("useFamily must be used inside FamilyProvider");
  return ctx;
}

export const RELATIONSHIPS = [
  "Mom",
  "Dad",
  "Daughter",
  "Son",
  "Sister",
  "Brother",
  "Grandmother",
  "Grandfather",
  "Cousin",
  "Aunt",
  "Uncle",
  "Partner",
  "Other",
];
