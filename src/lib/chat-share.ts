import { supabase } from "@/integrations/supabase/client";

/**
 * Share a memory update in the family's main chat, with up to a few media
 * previews attached. Best-effort: failures never block the memory itself.
 */
export async function shareMemoryToChat(opts: {
  familyId: string;
  senderId: string;
  text: string;
  media?: { path: string; kind: string }[];
}) {
  try {
    const { data: chat } = await supabase
      .from("chats")
      .select("id")
      .eq("family_id", opts.familyId)
      .order("is_main", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!chat) return;

    const { data: message, error } = await supabase
      .from("messages")
      .insert({
        chat_id: chat.id,
        family_id: opts.familyId,
        sender_id: opts.senderId,
        content: opts.text,
      })
      .select("id")
      .single();
    if (error || !message) return;

    const media = (opts.media ?? []).slice(0, 4);
    if (media.length) {
      await supabase.from("message_attachments").insert(
        media.map((m, i) => ({
          message_id: message.id,
          family_id: opts.familyId,
          url: m.path,
          kind: m.kind,
          position: i,
        })),
      );
    }
  } catch {
    // Sharing to chat is a nicety; ignore problems.
  }
}
