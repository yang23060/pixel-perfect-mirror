import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

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
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      void navigate({ to: "/auth", search: { next: `/join/${code}` } });
      return;
    }
    void navigate({ to: "/onboarding", search: { code } });
  }, [loading, session, code, navigate]);

  return (
    <div className="surface-warm flex min-h-screen items-center justify-center px-4 text-center">
      <p className="font-display text-xl">Opening your invitation…</p>
    </div>
  );
}
