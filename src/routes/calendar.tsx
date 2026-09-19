import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { CalendarPlus, ChevronLeft, ChevronRight, MapPin, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { FamilyImage } from "@/components/FamilyImage";
import { MemberAvatar } from "@/components/MemberAvatar";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/states";
import { useAuth } from "@/lib/auth";
import { useFamily } from "@/lib/family";
import { uploadFamilyImage } from "@/lib/media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Family calendar — Family Circle" },
      {
        name: "description",
        content:
          "One shared family calendar for gatherings, birthdays, appointments and travel, with RSVPs.",
      },
      { property: "og:title", content: "Family calendar — Family Circle" },
      {
        property: "og:description",
        content: "Plan family gatherings, birthdays and trips together, and RSVP in one tap.",
      },
    ],
  }),
  component: CalendarPage,
});

const CATEGORIES = [
  { value: "birthday", label: "Birthday" },
  { value: "gathering", label: "Family gathering" },
  { value: "appointment", label: "Appointment" },
  { value: "school", label: "School" },
  { value: "travel", label: "Travel" },
  { value: "anniversary", label: "Anniversary" },
  { value: "reminder", label: "Reminder" },
  { value: "other", label: "Other" },
] as const;

type EventRow = {
  id: string;
  family_id: string;
  created_by: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  location: string | null;
  category: string;
  cover_url: string | null;
  reminder_minutes: number | null;
  recurrence: string | null;
  event_attendees: { id: string; user_id: string; status: string | null }[];
};

/** Combine a local yyyy-MM-dd date with an HH:mm time into a local Date. */
function combineLocal(date: string, time: string, allDay: boolean): Date | null {
  if (!date) return null;
  const t = allDay ? "00:00" : time || "09:00";
  const parsed = new Date(`${date}T${t}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Split a stored timestamp into local date and time form values. */
function splitLocal(iso: string | null) {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  return { date: format(d, "yyyy-MM-dd"), time: format(d, "HH:mm") };
}

/** Create a new event, or edit an existing one when `event` is given. */
function EventDialog({
  event,
  open: openProp,
  onOpenChange,
}: {
  event?: EventRow;
  open?: boolean;
  onOpenChange?: (value: boolean) => void;
}) {
  const { familyId, members } = useFamily();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selfOpen, setSelfOpen] = useState(false);
  const open = openProp ?? selfOpen;
  const setOpen = onOpenChange ?? setSelfOpen;
  const editing = !!event;
  const start = splitLocal(event?.starts_at ?? null);
  const end = splitLocal(event?.ends_at ?? null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [startDate, setStartDate] = useState(start.date);
  const [startTime, setStartTime] = useState(start.time || "18:00");
  const [endDate, setEndDate] = useState(end.date);
  const [endTime, setEndTime] = useState(end.time);
  const [allDay, setAllDay] = useState(event?.all_day ?? false);
  const [location, setLocation] = useState(event?.location ?? "");
  const [category, setCategory] = useState(event?.category ?? "gathering");
  const [reminder, setReminder] = useState(
    event?.reminder_minutes == null ? (editing ? "none" : "60") : String(event.reminder_minutes),
  );
  const [recurrence, setRecurrence] = useState(event?.recurrence ?? "none");
  const [invited, setInvited] = useState<string[]>([]);
  const [cover, setCover] = useState<File | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !familyId || !user) return;
    const startsAt = combineLocal(startDate, startTime, allDay);
    const endsAt = combineLocal(endDate, endTime, allDay);
    if (!title.trim()) {
      toast.error("Please add a title.");
      return;
    }
    if (!startsAt) {
      toast.error("Please choose a start date.");
      return;
    }
    if (endsAt && endsAt.getTime() < startsAt.getTime()) {
      toast.error("The end time can't be before the start time.");
      return;
    }
    setBusy(true);
    try {
      let coverPath: string | null = event?.cover_url ?? null;
      if (cover) coverPath = await uploadFamilyImage(familyId, "events", cover);

      const fields = {
        title: title.trim(),
        description: description.trim() || null,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt ? endsAt.toISOString() : null,
        all_day: allDay,
        location: location.trim() || null,
        category: category as EventRow["category"] as never,
        cover_url: coverPath,
        reminder_minutes: reminder === "none" ? null : Number(reminder),
        recurrence: recurrence === "none" ? null : recurrence,
      };

      if (event) {
        const { error } = await supabase.from("events").update(fields).eq("id", event.id);
        if (error) throw error;
        toast.success("Event updated.");
      } else {
        const { data, error } = await supabase
          .from("events")
          .insert({ family_id: familyId, created_by: user.id, ...fields })
          .select("id")
          .single();
        if (error) throw error;

        const guests = invited.length ? invited : members.map((m) => m.user_id);
        await supabase.from("event_attendees").insert(
          guests.map((id) => ({
            event_id: data.id,
            family_id: familyId,
            user_id: id,
            status: id === user.id ? ("going" as const) : null,
          })),
        );
        const others = guests.filter((id) => id !== user.id);
        if (others.length) {
          await supabase.from("notifications").insert(
            others.map((id) => ({
              family_id: familyId,
              user_id: id,
              actor_id: user.id,
              type: "event",
              title: `New event: ${title.trim()}`,
              body: format(startsAt, allDay ? "eee d MMM" : "eee d MMM, HH:mm"),
              link: "/calendar",
            })),
          );
        }
        toast.success("Event added to the family calendar.");
        setTitle("");
        setDescription("");
        setStartDate("");
        setEndDate("");
        setEndTime("");
        setLocation("");
        setInvited([]);
      }
      setOpen(false);
      setCover(null);
      void queryClient.invalidateQueries({ queryKey: ["events"] });
      void queryClient.invalidateQueries({ queryKey: ["next-events"] });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : `Could not ${editing ? "update" : "create"} the event.`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!editing && (
        <DialogTrigger asChild>
          <Button size="lg">
            <CalendarPlus className="mr-2 size-5" /> New event
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit event" : "Create an event"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the details — everyone keeps their RSVP."
              : "Everyone invited can RSVP and see the details."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ev-title">Title</Label>
            <Input id="ev-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev-desc">Description</Label>
            <Textarea
              id="ev-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2">
            <Label htmlFor="ev-allday">All day</Label>
            <Switch id="ev-allday" checked={allDay} onCheckedChange={setAllDay} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ev-start">Starts</Label>
              <div className="flex gap-2">
                <Input
                  id="ev-start"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                {!allDay && (
                  <Input
                    aria-label="Start time"
                    type="time"
                    className="w-32"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-end">Ends (optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="ev-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
                {!allDay && (
                  <Input
                    aria-label="End time"
                    type="time"
                    className="w-32"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                )}
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev-loc">Location</Label>
            <Input id="ev-loc" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ev-cat">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="ev-cat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-remind">Reminder</Label>
              <Select value={reminder} onValueChange={setReminder}>
                <SelectTrigger id="ev-remind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No reminder</SelectItem>
                  <SelectItem value="30">30 minutes before</SelectItem>
                  <SelectItem value="60">1 hour before</SelectItem>
                  <SelectItem value="1440">1 day before</SelectItem>
                  <SelectItem value="10080">1 week before</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev-recur">Repeats</Label>
            <Select value={recurrence} onValueChange={setRecurrence}>
              <SelectTrigger id="ev-recur">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Does not repeat</SelectItem>
                <SelectItem value="weekly">Every week</SelectItem>
                <SelectItem value="monthly">Every month</SelectItem>
                <SelectItem value="yearly">Every year</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev-cover">Cover image</Label>
            <Input
              id="ev-cover"
              type="file"
              accept="image/*"
              onChange={(e) => setCover(e.target.files?.[0] ?? null)}
            />
          </div>
          {!editing && (
            <div>
              <span className="mb-1 block text-sm font-semibold">Invite (everyone by default)</span>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => {
                  const on = invited.includes(m.user_id);
                  return (
                    <button
                      key={m.user_id}
                      type="button"
                      onClick={() =>
                        setInvited((prev) =>
                          on ? prev.filter((x) => x !== m.user_id) : [...prev, m.user_id],
                        )
                      }
                      className={`rounded-full border px-3 py-1 text-sm ${
                        on ? "border-primary bg-sage/50 font-semibold" : "border-border"
                      }`}
                    >
                      {m.profile?.display_name ?? "Family member"}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Saving…" : editing ? "Save changes" : "Create event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EventCard({ event }: { event: EventRow }) {
  const { user } = useAuth();
  const { members, isAdmin } = useFamily();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const mine = event.created_by === user?.id;
  const myRsvp = event.event_attendees.find((a) => a.user_id === user?.id);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const rsvp = async (status: "going" | "maybe" | "cannot") => {
    if (!user) return;
    if (myRsvp) {
      const { error } = await supabase
        .from("event_attendees")
        .update({ status })
        .eq("id", myRsvp.id);
      if (error) {
        toast.error(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("event_attendees").insert({
        event_id: event.id,
        family_id: event.family_id,
        user_id: user.id,
        status,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
    }
    if (event.created_by !== user.id) {
      await supabase.from("notifications").insert({
        family_id: event.family_id,
        user_id: event.created_by,
        actor_id: user.id,
        type: "rsvp",
        title: `RSVP update for ${event.title}`,
        body: status === "cannot" ? "Can't go" : status === "maybe" ? "Maybe" : "Going",
        link: "/calendar",
      });
    }
    toast.success("Your RSVP is saved.");
    void queryClient.invalidateQueries({ queryKey: ["events"] });
  };

  const remove = async () => {
    const { error } = await supabase.from("events").delete().eq("id", event.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Event deleted.");
    void queryClient.invalidateQueries({ queryKey: ["events"] });
    void queryClient.invalidateQueries({ queryKey: ["next-events"] });
  };

  const going = event.event_attendees.filter((a) => a.status === "going");

  return (
    <article className="card-soft overflow-hidden">
      {event.cover_url && (
        <FamilyImage path={event.cover_url} alt={event.title} className="h-40 w-full" />
      )}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg">{event.title}</h3>
            <p className="text-sm text-muted-foreground">
              {event.all_day
                ? `${format(new Date(event.starts_at), "eee d MMM yyyy")} · All day`
                : `${format(new Date(event.starts_at), "eee d MMM yyyy, HH:mm")} (${tz})`}
            </p>
            {event.location && (
              <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="size-4" /> {event.location}
              </p>
            )}
          </div>
          <Badge variant="secondary">
            {CATEGORIES.find((c) => c.value === event.category)?.label ?? "Other"}
          </Badge>
          {(mine || isAdmin) && (
            <>
              <button
                aria-label="Edit event"
                onClick={() => setEditOpen(true)}
                className="p-1.5 text-muted-foreground hover:text-foreground"
              >
                <Pencil className="size-4" />
              </button>
              <button
                aria-label="Delete event"
                onClick={() => setConfirmDelete(true)}
                className="p-1.5 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </>
          )}
        </div>

        {event.description && <p className="mt-2 whitespace-pre-wrap">{event.description}</p>}

        <div className="mt-3 flex flex-wrap gap-2">
          {(["going", "maybe", "cannot"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={myRsvp?.status === s ? "default" : "outline"}
              onClick={() => void rsvp(s)}
            >
              {s === "going" ? "Going" : s === "maybe" ? "Maybe" : "Can't go"}
            </Button>
          ))}
        </div>

        {going.length > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Going:</span>
            {going.slice(0, 6).map((a) => {
              const p = members.find((m) => m.user_id === a.user_id)?.profile;
              return (
                <MemberAvatar
                  key={a.id}
                  name={p?.display_name ?? null}
                  avatarPath={p?.avatar_url ?? null}
                  className="size-8"
                />
              );
            })}
          </div>
        )}
      </div>

      {editOpen && (
        <EventDialog
          key={`${event.id}-${event.updated_at}`}
          event={event}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}


      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>
              It will disappear from everyone's calendar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep event</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}

function CalendarPage() {
  const { familyId, members } = useFamily();
  const [month, setMonth] = useState(new Date());
  const [selected, setSelected] = useState<Date | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["events", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*, event_attendees(id, user_id, status)")
        .eq("family_id", familyId!)
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as EventRow[];
    },
  });

  const events = data ?? [];

  const birthdays = useMemo(() => {
    const list: { date: Date; label: string }[] = [];
    for (const m of members) {
      if (m.profile?.birthday) {
        const b = new Date(m.profile.birthday);
        list.push({
          date: new Date(month.getFullYear(), b.getMonth(), b.getDate()),
          label: `${m.profile.display_name}'s birthday`,
        });
      }
      if (m.profile?.anniversary) {
        const a = new Date(m.profile.anniversary);
        list.push({
          date: new Date(month.getFullYear(), a.getMonth(), a.getDate()),
          label: `${m.profile.display_name}'s anniversary`,
        });
      }
    }
    return list;
  }, [members, month]);

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });

  const upcoming = events.filter((e) => new Date(e.starts_at) >= new Date(Date.now() - 86400000));
  const dayEvents = selected
    ? events.filter((e) => isSameDay(new Date(e.starts_at), selected))
    : [];
  const dayBirthdays = selected ? birthdays.filter((b) => isSameDay(b.date, selected)) : [];

  return (
    <AppShell title="Calendar">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <EventDialog />
        </div>

        <Tabs defaultValue="month">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="agenda">Agenda</TabsTrigger>
          </TabsList>

          <TabsContent value="month" className="space-y-4 pt-4">
            <div className="card-soft p-3">
              <div className="mb-2 flex items-center justify-between">
                <Button variant="ghost" size="icon" onClick={() => setMonth(subMonths(month, 1))}>
                  <ChevronLeft className="size-5" />
                </Button>
                <h2 className="font-display text-lg">{format(month, "MMMM yyyy")}</h2>
                <Button variant="ghost" size="icon" onClick={() => setMonth(addMonths(month, 1))}>
                  <ChevronRight className="size-5" />
                </Button>
              </div>
              <div className="grid grid-cols-7 text-center text-xs font-semibold text-muted-foreground">
                {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                  <span key={i} className="py-1">
                    {d}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {days.map((day) => {
                  const count =
                    events.filter((e) => isSameDay(new Date(e.starts_at), day)).length +
                    birthdays.filter((b) => isSameDay(b.date, day)).length;
                  const isSelected = selected && isSameDay(day, selected);
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelected(day)}
                      className={`flex aspect-square flex-col items-center justify-center rounded-xl text-sm ${
                        isSelected
                          ? "bg-primary font-bold text-primary-foreground"
                          : isSameMonth(day, month)
                            ? "hover:bg-muted"
                            : "text-muted-foreground/50"
                      } ${isSameDay(day, new Date()) && !isSelected ? "bg-sage/50 font-bold" : ""}`}
                    >
                      {format(day, "d")}
                      {count > 0 && (
                        <span
                          className={`mt-0.5 size-1.5 rounded-full ${isSelected ? "bg-primary-foreground" : "bg-rose"}`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {selected && (
              <div className="space-y-3">
                <h3 className="font-display text-lg">{format(selected, "eeee d MMMM")}</h3>
                {dayBirthdays.map((b) => (
                  <div key={b.label} className="rounded-2xl bg-accent px-4 py-3 font-semibold">
                    🎂 {b.label}
                  </div>
                ))}
                {dayEvents.length === 0 && dayBirthdays.length === 0 ? (
                  <p className="text-muted-foreground">Nothing planned for this day yet.</p>
                ) : (
                  dayEvents.map((e) => <EventCard key={e.id} event={e} />)
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="agenda" className="space-y-4 pt-4">
            {isLoading && <LoadingBlock />}
            {error && <ErrorState message="We couldn't load the calendar." />}
            {!isLoading && upcoming.length === 0 && (
              <EmptyState
                title="No upcoming events"
                description="Create your first family event and everyone can RSVP."
              />
            )}
            {upcoming.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
