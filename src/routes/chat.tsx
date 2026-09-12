import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isSameDay } from "date-fns";
import { MessageCircle, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { MemberAvatar } from "@/components/MemberAvatar";
import { EmptyState, LoadingBlock } from "@/components/states";
import { useAuth } from "@/lib/auth";
import { useFamily } from "@/lib/family";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Family chat — Family Circle" },
      {
        name: "description",
        content: "A private real-time family chat for everyday messages and photos.",
      },
      { property: "og:title", content: "Family chat — Family Circle" },
      { property: "og:description", content: "Chat with your family in real time, privately." },
    ],
  }),
  component: ChatPage,
});

type MessageRow = {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string | null;
  created_at: string;
};

function ChatPage() {
  const { familyId, members } = useFamily();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [chatId, setChatId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const chats = useQuery({
    queryKey: ["chats", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chats")
        .select("*")
        .eq("family_id", familyId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const activeChat = chats.data?.find((c) => c.id === chatId) ?? chats.data?.[0] ?? null;

  const messages = useQuery({
    queryKey: ["messages", activeChat?.id],
    enabled: !!activeChat,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, chat_id, sender_id, content, created_at")
        .eq("chat_id", activeChat!.id)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as MessageRow[];
    },
  });

  useEffect(() => {
    if (!activeChat) return;
    const channel = supabase
      .channel(`chat-${activeChat.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `chat_id=eq.${activeChat.id}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["messages", activeChat.id] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeChat, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data?.length]);

  const send = async () => {
    if (!text.trim() || !activeChat || !user || !familyId) return;
    const body = text.trim();
    setText("");
    const { error } = await supabase.from("messages").insert({
      chat_id: activeChat.id,
      family_id: familyId,
      sender_id: user.id,
      content: body,
    });
    if (error) {
      toast.error(error.message);
      setText(body);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["messages", activeChat.id] });
  };

  const name = (id: string) =>
    members.find((m) => m.user_id === id)?.profile?.display_name ?? "Family member";
  const avatar = (id: string) =>
    members.find((m) => m.user_id === id)?.profile?.avatar_url ?? null;

  return (
    <AppShell title={activeChat?.name ?? "Chat"}>
      <div className="space-y-4">
        {(chats.data?.length ?? 0) > 1 && (
          <div className="flex gap-2 overflow-x-auto">
            {chats.data?.map((c) => (
              <button
                key={c.id}
                onClick={() => setChatId(c.id)}
                className={`shrink-0 rounded-full border px-4 py-2 font-semibold ${
                  activeChat?.id === c.id ? "border-primary bg-sage/50" : "border-border"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {messages.isLoading && <LoadingBlock rows={2} />}
        {!messages.isLoading && (messages.data?.length ?? 0) === 0 && (
          <EmptyState
            icon={<MessageCircle className="size-8" />}
            title="No messages yet"
            description="Say hello to your family."
          />
        )}

        <div className="space-y-3">
          {messages.data?.map((m, i) => {
            const prev = messages.data?.[i - 1];
            const newDay =
              !prev || !isSameDay(new Date(prev.created_at), new Date(m.created_at));
            const mine = m.sender_id === user?.id;
            return (
              <div key={m.id}>
                {newDay && (
                  <p className="my-3 text-center text-sm text-muted-foreground">
                    {format(new Date(m.created_at), "eeee d MMMM")}
                  </p>
                )}
                <div className={`flex items-end gap-2 ${mine ? "justify-end" : ""}`}>
                  {!mine && (
                    <MemberAvatar
                      name={name(m.sender_id)}
                      avatarPath={avatar(m.sender_id)}
                      className="size-9"
                    />
                  )}
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                      mine ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    {!mine && <p className="text-sm font-semibold">{name(m.sender_id)}</p>}
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    <p className="mt-0.5 text-xs opacity-70">
                      {format(new Date(m.created_at), "HH:mm")}
                    </p>
                  </div>
                  {mine && (
                    <button
                      aria-label="Delete message"
                      onClick={async () => {
                        const { error } = await supabase.from("messages").delete().eq("id", m.id);
                        if (error) toast.error(error.message);
                        else
                          void queryClient.invalidateQueries({
                            queryKey: ["messages", activeChat?.id],
                          });
                      }}
                      className="p-1 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div className="sticky bottom-20 flex gap-2 bg-background py-2 md:bottom-0">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a message…"
            onKeyDown={(e) => {
              if (e.key === "Enter") void send();
            }}
          />
          <Button onClick={() => void send()} disabled={!text.trim()} aria-label="Send">
            <Send className="size-5" />
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
