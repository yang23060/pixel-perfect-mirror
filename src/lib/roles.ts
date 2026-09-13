import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/** True when the signed-in account holds the platform creator role. */
export function usePlatformAdmin() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["platform-admin", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "platform_admin")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
  return { isPlatformAdmin: query.data === true, loading: query.isLoading };
}

/** Writes one row to the moderation audit trail. Never throws. */
export async function logAdminAction(
  adminId: string,
  action: string,
  target: { type?: string; id?: string | null; details?: Record<string, unknown> } = {},
) {
  await supabase.from("admin_audit_log").insert({
    admin_id: adminId,
    action,
    target_type: target.type ?? null,
    target_id: target.id ?? null,
    details: (target.details ?? null) as never,
  });
}
