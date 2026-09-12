import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    next:
      typeof search["next"] === "string" && (search["next"] as string).startsWith("/")
        ? (search["next"] as string)
        : "/",
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Family Circle" },
      {
        name: "description",
        content: "Sign in or create your Family Circle account to reach your private family space.",
      },
      { property: "og:title", content: "Sign in — Family Circle" },
      {
        property: "og:description",
        content: "Private, invite-only family sharing. Sign in to continue.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState("signin");

  useEffect(() => {
    if (!loading && session) void navigate({ to: next });
  }, [loading, session, navigate, next]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back!");
    void navigate({ to: next });
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!displayName.trim()) {
      toast.error("Please enter your name.");
      return;
    }
    if (password.length < 6) {
      toast.error("Use a password with at least 6 characters.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: displayName.trim() },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data.session) {
      toast.success("Check your email to confirm your account, then sign in.");
      setMode("signin");
      return;
    }
    toast.success("Account created!");
    void navigate({ to: "/onboarding" });
  };

  const resetPassword = async () => {
    if (!email.trim()) {
      toast.error("Enter your email first.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("We sent you a password reset email.");
  };

  const googleSignIn = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in didn't work. Please try again.");
      return;
    }
  };

  return (
    <div className="surface-warm flex min-h-screen items-center justify-center px-4 py-10">
      <div className="card-soft w-full max-w-md p-7">
        <div className="mb-6 text-center">
          <Heart className="mx-auto size-9 text-rose" />
          <h1 className="mt-3 font-display text-3xl">Family Circle</h1>
          <p className="mt-1 text-muted-foreground">
            A private place for the people who matter most.
          </p>
        </div>

        <Tabs value={mode} onValueChange={setMode}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Create account</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <form onSubmit={signIn} className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </Button>
              <button
                type="button"
                onClick={resetPassword}
                className="w-full text-sm text-muted-foreground underline"
              >
                Forgot your password?
              </button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={signUp} className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Your name</Label>
                <Input
                  id="name"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email2">Email</Label>
                <Input
                  id="email2"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password2">Password</Label>
                <Input
                  id="password2"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={busy}>
                {busy ? "Creating account…" : "Create account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="my-5 flex items-center gap-3 text-sm text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>
        <Button variant="outline" size="lg" className="w-full" onClick={googleSignIn}>
          Continue with Google
        </Button>
      </div>
    </div>
  );
}
