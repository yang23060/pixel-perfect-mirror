import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { MemberAvatar } from "@/components/MemberAvatar";
import { useAuth } from "@/lib/auth";
import { useFamily } from "@/lib/family";
import { uploadAvatar } from "@/lib/media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Family Circle" },
      {
        name: "description",
        content: "Update your profile, manage family invitations, privacy and membership.",
      },
      { property: "og:title", content: "Settings — Family Circle" },
      { property: "og:description", content: "Your profile, invitations and privacy settings." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const { family, familyId, isAdmin, refresh, memberships } = useFamily();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [favorites, setFavorites] = useState("");
  const [birthday, setBirthday] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [shareContact, setShareContact] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [familyName, setFamilyName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? "");
    setBio(profile.bio ?? "");
    setFavorites(profile.favorite_things ?? "");
    setBirthday(profile.birthday ?? "");
    setContactEmail(profile.contact_email ?? "");
    setContactPhone(profile.contact_phone ?? "");
    setShareContact(profile.share_contact);
  }, [profile]);

  useEffect(() => {
    setFamilyName(family?.name ?? "");
  }, [family?.name]);

  const invites = useQuery({
    queryKey: ["invites", familyId],
    enabled: !!familyId && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_invites")
        .select("*")
        .eq("family_id", familyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !user) return;
    setBusy(true);
    try {
      let avatarPath = profile?.avatar_url ?? null;
      if (avatarFile) avatarPath = await uploadAvatar(user.id, avatarFile);
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim(),
          bio: bio.trim() || null,
          favorite_things: favorites.trim() || null,
          birthday: birthday || null,
          contact_email: contactEmail.trim() || null,
          contact_phone: contactPhone.trim() || null,
          share_contact: shareContact,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        })
        .eq("id", user.id);
      if (error) throw error;
      refreshProfile();
      refresh();
      void queryClient.invalidateQueries({ queryKey: ["members"] });
      toast.success("Profile saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save your profile.");
    } finally {
      setBusy(false);
    }
  };

  const saveFamily = async () => {
    if (!familyId || !familyName.trim()) return;
    const { error } = await supabase
      .from("families")
      .update({ name: familyName.trim() })
      .eq("id", familyId);
    if (error) {
      toast.error(error.message);
      return;
    }
    refresh();
    toast.success("Family updated.");
  };

  const newInvite = async () => {
    if (!familyId || !user) return;
    const code = Math.random().toString(36).slice(2, 10).toUpperCase();
    const { error } = await supabase
      .from("family_invites")
      .insert({ family_id: familyId, code, created_by: user.id });
    if (error) {
      toast.error(error.message);
      return;
    }
    void invites.refetch();
    toast.success("New invitation code created.");
  };

  const toggleInvite = async (id: string, active: boolean) => {
    const { error } = await supabase.from("family_invites").update({ active }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void invites.refetch();
  };

  const leaveFamily = async () => {
    const membership = memberships.find((m) => m.family_id === familyId);
    if (!membership) return;
    const { error } = await supabase.from("family_members").delete().eq("id", membership.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    refresh();
    toast.success("You left the family.");
    void navigate({ to: "/onboarding", search: { code: "" } });
  };

  const deleteFamily = async () => {
    if (!familyId) return;
    const { error } = await supabase.from("families").delete().eq("id", familyId);
    if (error) {
      toast.error(error.message);
      return;
    }
    refresh();
    toast.success("Family deleted.");
    void navigate({ to: "/onboarding", search: { code: "" } });
  };

  return (
    <AppShell title="Settings">
      <div className="space-y-5">
        <form onSubmit={saveProfile} className="card-soft space-y-4 p-5">
          <h2 className="font-display text-xl">Your profile</h2>
          <div className="flex items-center gap-4">
            <MemberAvatar
              name={displayName || null}
              avatarPath={profile?.avatar_url ?? null}
              className="size-16"
            />
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="avatar">Profile photo</Label>
              <Input
                id="avatar"
                type="file"
                accept="image/*"
                onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Display name</Label>
            <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bday">Birthday</Label>
            <Input id="bday" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Short bio</Label>
            <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fav">Favourite things</Label>
            <Input id="fav" value={favorites} onChange={(e) => setFavorites(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cemail">Contact email</Label>
              <Input id="cemail" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cphone">Contact phone</Label>
              <Input id="cphone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2">
            <Label htmlFor="share">Share my contact details with my family</Label>
            <Switch id="share" checked={shareContact} onCheckedChange={setShareContact} />
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Saving…" : "Save profile"}
          </Button>
        </form>

        <NotificationPrefsCard />

        {isAdmin && (
          <div className="card-soft space-y-4 p-5">
            <h2 className="font-display text-xl">Family settings</h2>
            <div className="space-y-1.5">
              <Label htmlFor="fname">Family name</Label>
              <Input id="fname" value={familyName} onChange={(e) => setFamilyName(e.target.value)} />
            </div>
            <Button variant="outline" onClick={() => void saveFamily()}>
              Save family name
            </Button>

            <div className="space-y-2 pt-2">
              <h3 className="font-semibold">Invitation codes</h3>
              {invites.data?.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center gap-2 rounded-xl border border-border px-3 py-2"
                >
                  <span className="flex-1 font-mono text-lg">{inv.code}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Copy invitation link"
                    onClick={() => {
                      void navigator.clipboard.writeText(
                        `${window.location.origin}/join/${inv.code}`,
                      );
                      toast.success("Invitation link copied.");
                    }}
                  >
                    <Copy className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant={inv.active ? "outline" : "default"}
                    onClick={() => void toggleInvite(inv.id, !inv.active)}
                  >
                    {inv.active ? "Expire" : "Reactivate"}
                  </Button>
                </div>
              ))}
              <Button variant="outline" onClick={() => void newInvite()}>
                <RefreshCw className="mr-2 size-4" /> Generate new code
              </Button>
            </div>
          </div>
        )}

        <div className="card-soft space-y-3 p-5">
          <h2 className="font-display text-xl">Membership</h2>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full">
                Leave this family
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Leave {family?.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  You'll lose access to this family's posts, photos and chats.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Stay</AlertDialogCancel>
                <AlertDialogAction onClick={() => void leaveFamily()}>Leave</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {isAdmin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full text-destructive">
                  Delete this family
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {family?.name} permanently?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Every post, photo, event and message in this family will be deleted for
                    everyone. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep family</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void deleteFamily()}>
                    Delete family
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <Button
            variant="ghost"
            className="w-full"
            onClick={async () => {
              await signOut();
              void navigate({ to: "/auth", search: { next: "/" } });
            }}
          >
            Log out
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
