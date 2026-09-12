import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { SearchIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/states";
import { useFamily } from "@/lib/family";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search — Family Circle" },
      {
        name: "description",
        content: "Search your family's posts, members, events, albums and photo captions.",
      },
      { property: "og:title", content: "Search — Family Circle" },
      { property: "og:description", content: "Find anything shared in your family space." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { familyId, members } = useFamily();
  const [term, setTerm] = useState("");
  const q = term.trim();

  const results = useQuery({
    queryKey: ["search", familyId, q],
    enabled: !!familyId && q.length > 1,
    queryFn: async () => {
      const like = `%${q}%`;
      const [posts, events, albums, photos] = await Promise.all([
        supabase
          .from("posts")
          .select("id, content, created_at")
          .eq("family_id", familyId!)
          .ilike("content", like)
          .limit(20),
        supabase
          .from("events")
          .select("id, title, starts_at")
          .eq("family_id", familyId!)
          .ilike("title", like)
          .limit(20),
        supabase
          .from("albums")
          .select("id, title, created_at")
          .eq("family_id", familyId!)
          .ilike("title", like)
          .limit(20),
        supabase
          .from("photos")
          .select("id, caption")
          .eq("family_id", familyId!)
          .ilike("caption", like)
          .limit(20),
      ]);
      return {
        posts: posts.data ?? [],
        events: events.data ?? [],
        albums: albums.data ?? [],
        photos: photos.data ?? [],
      };
    },
  });

  const people = members.filter((m) =>
    (m.profile?.display_name ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  const empty =
    q.length > 1 &&
    results.data &&
    people.length === 0 &&
    results.data.posts.length === 0 &&
    results.data.events.length === 0 &&
    results.data.albums.length === 0 &&
    results.data.photos.length === 0;

  return (
    <AppShell title="Search">
      <div className="space-y-4">
        <Input
          autoFocus
          placeholder="Search posts, people, events, albums…"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />

        {q.length < 2 && (
          <EmptyState
            icon={<SearchIcon className="size-8" />}
            title="Start typing"
            description="Search across everything your family has shared."
          />
        )}

        {empty && <EmptyState title="No matches" description={`Nothing found for “${q}”.`} />}

        {q.length > 1 && people.length > 0 && (
          <section className="card-soft p-4">
            <h2 className="mb-2 font-display text-lg">People</h2>
            <ul className="space-y-1">
              {people.map((m) => (
                <li key={m.user_id} className="font-semibold">
                  {m.profile?.display_name} · {m.relationship ?? "Family"}
                </li>
              ))}
            </ul>
          </section>
        )}

        {results.data?.posts.length ? (
          <section className="card-soft p-4">
            <h2 className="mb-2 font-display text-lg">Posts</h2>
            <ul className="space-y-2">
              {results.data.posts.map((p) => (
                <li key={p.id}>
                  <p className="line-clamp-2">{p.content}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(p.created_at), "d MMM yyyy")}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {results.data?.events.length ? (
          <section className="card-soft p-4">
            <h2 className="mb-2 font-display text-lg">Events</h2>
            <ul className="space-y-1">
              {results.data.events.map((e) => (
                <li key={e.id} className="font-semibold">
                  {e.title}{" "}
                  <span className="font-normal text-muted-foreground">
                    {format(new Date(e.starts_at), "d MMM yyyy")}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {results.data?.albums.length ? (
          <section className="card-soft p-4">
            <h2 className="mb-2 font-display text-lg">Albums</h2>
            <ul className="space-y-1">
              {results.data.albums.map((a) => (
                <li key={a.id} className="font-semibold">
                  {a.title}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {results.data?.photos.length ? (
          <section className="card-soft p-4">
            <h2 className="mb-2 font-display text-lg">Photo captions</h2>
            <ul className="space-y-1">
              {results.data.photos.map((p) => (
                <li key={p.id}>{p.caption}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
