import { createFileRoute, Link } from "@tanstack/react-router";
import { HeartHandshake, Vote } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PostFeed } from "@/components/posts";
import { NewMemoryDialog } from "@/components/NewMemoryDialog";
import { StoryRow } from "@/components/stories";
import { ConversationPrompt, NextEvent, UpcomingBirthdays } from "@/components/HomeWidgets";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Family feed — Family Circle" },
      {
        name: "description",
        content:
          "Your private family feed: news, photos, celebrations, birthdays and everyday moments in one place.",
      },
      { property: "og:title", content: "Family feed — Family Circle" },
      {
        property: "og:description",
        content: "Share news, photos and everyday moments privately with your family.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <AppShell>
      <div className="space-y-4">
        <StoryRow />
        <ConversationPrompt />
        <div className="grid gap-4 sm:grid-cols-2">
          <UpcomingBirthdays />
          <NextEvent />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button asChild variant="outline" size="lg">
            <Link to="/polls">
              <Vote className="mr-2 size-5" /> Family polls
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/appreciation">
              <HeartHandshake className="mr-2 size-5" /> Appreciation
            </Link>
          </Button>
        </div>

        <div className="card-soft p-4">
          <NewMemoryDialog triggerLabel="Share a moment" />
        </div>

        <Tabs defaultValue="all">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="all">Family feed</TabsTrigger>
            <TabsTrigger value="highlights">Highlights</TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="pt-4">
            <PostFeed />
          </TabsContent>
          <TabsContent value="highlights" className="pt-4">
            <PostFeed highlightsOnly />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
