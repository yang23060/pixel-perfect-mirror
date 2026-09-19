import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useFamily } from "@/lib/family";

export const Route = createFileRoute("/join/$code")({
  head: () => ({
    meta: [
      { title: "Join a family — Family Circle" },
      { name: "description", content: "Use your invitation link to join a private family space." },
      { property: "og:title", content: "Join a family — Family Circle" },
      { property: "og:description", content: "Use your invitation link to join a family space." },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const { code } = Route.useParams();
  const { session, user, loading, refreshProfile } = useAuth();
  const { refresh, setFamilyId } = useFamily();
  const navigate = useNavigate();
  const ran = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      void navigate({ to: "/auth", search: { next: `/join/${code}` } });
      return;
    }
    if (ran.current || !user) return;
    ran.current = true;

    void (async () => {
      const { data, error: rpcError } = await supabase.rpc("join_family_with_code", {
        _code: code.trim(),
        _relationship: "Other",
      });
      if (rpcError) {
        setError(rpcError.message);
        toast.error(rpcError.message);
        return;
      }
      const familyId = data as unknown as string;
      await supabase.from("profiles").update({ onboarded: true }).eq("id", user.id);
      refreshProfile();
      refresh();
      setFamilyId(familyId);
      toast.success("You're in!");
      void navigate({ to: "/family" });
    })();
  }, [loading, session, user, code, navigate, refresh, setFamilyId, refreshProfile]);

  return (
    <div className="surface-warm flex min-h-screen items-center justify-center px-4 text-center">
      {error ? (
        <div className="card-soft max-w-sm p-6">
          <p className="font-display text-xl">That invitation didn't work</p>
          <p className="mt-2 text-muted-foreground">{error}</p>
        </div>
      ) : (
        <p className="font-display text-xl">Joining your family…</p>
      )}
    </div>
  );
}
