import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { format, isSameDay } from "date-fns";
import { Cake, CalendarDays, MessageCircleHeart, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useFamily } from "@/lib/family";
import { MemberAvatar } from "@/components/MemberAvatar";
import { Button } from "@/components/ui/button";

const PROMPTS = [
  "What is your favourite childhood memory?",
  "What made you smile this week?",
  "Which family recipe do you miss most?",
  "What song always reminds you of home?",
  "What is something you're looking forward to?",
  "Who in the family makes you laugh the most?",
  "What is the best advice a relative gave you?",
];

const CHECKINS = [
  { value: "great", label: "Great" },
  { value: "good", label: "Good" },
  { value: "okay", label: "Okay" },
  { value: "tired", label: "Tired" },
  { value: "need_support", label: "Need support" },
] as const;

function daysUntilBirthday(birthday: string) {
  const today = new Date();
  const b = new Date(birthday);
  const next = new Date(today.getFullYear(), b.getMonth(), b.getDate());
  if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
    next.setFullYear(today.getFullYear() + 1);
  }
  return {
    days: Math.round((next.getTime() - new Date(today.toDateString()).getTime()) / 86400000),
    date: next,
  };
}

export function UpcomingBirthdays() {
  const { members } = useFamily();
  const upcoming = members
    .filter((m) => m.profile?.birthday)
    .map((m) => ({ member: m, ...daysUntilBirthday(m.profile!.birthday!) }))
    .filter((x) => x.days <= 60)
    .sort((a, b) => a.days - b.days)
    .slice(0, 3);

  if (upcoming.length === 0) return null;

  return (
    <div className="card-soft p-4">
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg">
        <Cake className="size-5 text-rose" /> Upcoming birthdays
      </h2>
      <ul className="space-y-2">
        {upcoming.map(({ member, days, date }) => (
          <li key={member.user_id} className="flex items-center gap-3">
            <MemberAvatar
              name={member.profile?.display_name ?? null}
              avatarPath={member.profile?.avatar_url ?? null}
              className="size-9"
            />
            <span className="flex-1 font-semibold">{member.profile?.display_name}</span>
            <span className="text-sm text-muted-foreground">
              {days === 0 ? "Today!" : `${format(date, "d MMM")} · in ${days} day${days === 1 ? "" : "s"}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NextEvent() {
  const { familyId } = useFamily();
  const { data } = useQuery({
    queryKey: ["next-events", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, starts_at, location, all_day")
        .eq("family_id", familyId!)
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(3);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!data || data.length === 0) return null;

  return (
    <div className="card-soft p-4">
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg">
        <CalendarDays className="size-5 text-primary" /> Coming up
      </h2>
      <ul className="space-y-2">
        {data.map((e) => (
          <li key={e.id} className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-sage text-sage-foreground">
              <span className="text-xs font-semibold uppercase">
                {format(new Date(e.starts_at), "MMM")}
              </span>
              <span className="text-lg font-bold leading-none">
                {format(new Date(e.starts_at), "d")}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{e.title}</p>
              <p className="truncate text-sm text-muted-foreground">
                {e.all_day
                  ? "All day"
                  : format(new Date(e.starts_at), "eee d MMM, HH:mm")}
                {e.location ? ` · ${e.location}` : ""}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <Button asChild variant="ghost" className="mt-2 w-full">
        <Link to="/calendar">Open calendar</Link>
      </Button>
    </div>
  );
}

export function ConversationPrompt() {
  const index = new Date().getDate() % PROMPTS.length;
  return (
    <div className="rounded-2xl bg-accent p-4 text-accent-foreground shadow-soft">
      <h2 className="flex items-center gap-2 font-display text-lg">
        <Sparkles className="size-5" /> Family question of the day
      </h2>
      <p className="mt-1 text-[1.05rem]">{PROMPTS[index]}</p>
    </div>
  );
}

export function CheckInCard() {
  const { user } = useAuth();
  const { familyId, members } = useFamily();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["check-ins", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("check_ins")
        .select("*")
        .eq("family_id", familyId!)
        .gte("created_at", new Date(Date.now() - 86400000).toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const mine = data?.find(
    (c) => c.user_id === user?.id && isSameDay(new Date(c.created_at), new Date()),
  );

  const save = async (status: (typeof CHECKINS)[number]["value"]) => {
    if (!familyId || !user) return;
    const { error } = await supabase
      .from("check_ins")
      .insert({ family_id: familyId, user_id: user.id, status });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Thanks for checking in.");
    void queryClient.invalidateQueries({ queryKey: ["check-ins"] });
  };

  return (
    <div className="card-soft p-4">
      <h2 className="mb-2 flex items-center gap-2 font-display text-lg">
        <MessageCircleHeart className="size-5 text-rose" /> How are you feeling today?
      </h2>
      <div className="flex flex-wrap gap-2">
        {CHECKINS.map((c) => (
          <button
            key={c.value}
            onClick={() => void save(c.value)}
            className={`rounded-full border px-4 py-2 font-semibold ${
              mine?.status === c.value ? "border-primary bg-sage/60" : "border-border hover:bg-muted"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      {data && data.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
          {data.slice(0, 4).map((c) => (
            <li key={c.id}>
              {members.find((m) => m.user_id === c.user_id)?.profile?.display_name ??
                "Family member"}{" "}
              is feeling{" "}
              <span className="font-semibold text-foreground">
                {CHECKINS.find((x) => x.value === c.status)?.label.toLowerCase()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
