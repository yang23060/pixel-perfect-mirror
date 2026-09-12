import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Heart, Home, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { RELATIONSHIPS, useFamily } from "@/lib/family";
import { uploadAvatar, uploadFamilyImage } from "@/lib/media";
import { MemberAvatar } from "@/components/MemberAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/onboarding")({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search["code"] === "string" ? (search["code"] as string) : "",
  }),
  head: () => ({
    meta: [
      { title: "Set up your family space — Family Circle" },
      {
        name: "description",
        content: "Tell your family who you are, then create a new family or join with an invite code.",
      },
      { property: "og:title", content: "Set up your family space — Family Circle" },
      {
        property: "og:description",
        content: "Create your family or join an existing one with an invitation code.",
      },
    ],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const { code } = Route.useSearch();
  const { user, profile, loading, refreshProfile } = useAuth();
  const { refresh, setFamilyId, memberships } = useFamily();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2>(1);
  const [displayName, setDisplayName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [relationship, setRelationship] = useState("Other");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const [choice, setChoice] = useState<"create" | "join">(code ? "join" : "create");
  const [familyName, setFamilyName] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [inviteCode, setInviteCode] = useState(code);

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth", search: { next: "/onboarding" } });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (profile) {
      setDisplayName((prev) => prev || profile.display_name || "");
      setBirthday((prev) => prev || profile.birthday || "");
    }
  }, [profile]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !user) return;
    if (!displayName.trim()) {
      toast.error("Please enter your name.");
      return;
    }
    setBusy(true);
    try {
      let avatarPath = profile?.avatar_url ?? null;
      if (avatarFile) avatarPath = await uploadAvatar(user.id, avatarFile);
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim(),
          birthday: birthday || null,
          avatar_url: avatarPath,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        })
        .eq("id", user.id);
      if (error) throw error;
      refreshProfile();
      setStep(2);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save your details.");
    } finally {
      setBusy(false);
    }
  };

  const finish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !user) return;
    setBusy(true);
    try {
      let familyId: string;
      if (choice === "create") {
        if (!familyName.trim()) throw new Error("Please name your family.");
        const { data, error } = await supabase.rpc("create_family", {
          _name: familyName.trim(),
          _cover_url: null,
          _relationship: relationship,
        });
        if (error) throw error;
        familyId = data as unknown as string;
        if (coverFile) {
          const path = await uploadFamilyImage(familyId, "covers", coverFile);
          await supabase.from("families").update({ cover_url: path }).eq("id", familyId);
        }
      } else {
        if (!inviteCode.trim()) throw new Error("Enter your invitation code.");
        const { data, error } = await supabase.rpc("join_family_with_code", {
          _code: inviteCode.trim(),
          _relationship: relationship,
        });
        if (error) throw error;
        familyId = data as unknown as string;
      }
      await supabase.from("profiles").update({ onboarded: true }).eq("id", user.id);
      refreshProfile();
      refresh();
      setFamilyId(familyId);
      toast.success(choice === "create" ? "Your family space is ready!" : "You're in!");
      void navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="surface-warm min-h-screen px-4 py-10">
      <div className="card-soft mx-auto w-full max-w-lg p-7">
        <div className="mb-6 text-center">
          <Heart className="mx-auto size-8 text-rose" />
          <h1 className="mt-3 font-display text-2xl">
            {step === 1 ? "Tell us about you" : "Your family space"}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {step === 1
              ? "This is how your family will see you."
              : "Create a new family or join one with an invitation code."}
          </p>
        </div>

        {step === 1 ? (
          <form onSubmit={saveProfile} className="space-y-5">
            <div className="flex items-center gap-4">
              <MemberAvatar
                name={displayName || profile?.display_name || null}
                avatarPath={profile?.avatar_url ?? null}
                className="size-16"
              />
              <div className="flex-1">
                <Label htmlFor="photo">Profile photo (optional)</Label>
                <Input
                  id="photo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="display-name">Display name</Label>
              <Input
                id="display-name"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="birthday">Birthday</Label>
              <Input
                id="birthday"
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="relationship">You are the family's…</Label>
              <Select value={relationship} onValueChange={setRelationship}>
                <SelectTrigger id="relationship">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIPS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? "Saving…" : "Continue"}
            </Button>
          </form>
        ) : (
          <form onSubmit={finish} className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setChoice("create")}
                className={`flex flex-col items-center gap-2 rounded-2xl border p-4 font-semibold ${
                  choice === "create" ? "border-primary bg-sage/40" : "border-border"
                }`}
              >
                <Home className="size-6" /> Create a family
              </button>
              <button
                type="button"
                onClick={() => setChoice("join")}
                className={`flex flex-col items-center gap-2 rounded-2xl border p-4 font-semibold ${
                  choice === "join" ? "border-primary bg-sage/40" : "border-border"
                }`}
              >
                <Users className="size-6" /> Join a family
              </button>
            </div>

            {choice === "create" ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="family-name">Family name</Label>
                  <Input
                    id="family-name"
                    placeholder="The Yang Family"
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cover">Cover photo (optional)</Label>
                  <Input
                    id="cover"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="invite">Invitation code</Label>
                <Input
                  id="invite"
                  placeholder="ABC12345"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="relationship2">Your relationship in this family</Label>
              <Select value={relationship} onValueChange={setRelationship}>
                <SelectTrigger id="relationship2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIPS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? "Setting things up…" : choice === "create" ? "Create family" : "Join family"}
            </Button>
            {memberships.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => void navigate({ to: "/" })}
              >
                Back to my family
              </Button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
