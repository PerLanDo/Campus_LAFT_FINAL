// src/lib/supabase/client.ts
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs";
import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import { Message } from "@/types/database";

// Define extended Message type with recipient_id and read_at
export interface ExtendedMessage extends Message {
  recipient_id?: string;
  read_at?: string | null;
}

// Attachment type
export interface MessageAttachment {
  path: string;
  url: string;
}

// Enhance error handling for Supabase client
export const createSupabaseBrowserClient = () => {
  try {
    return createPagesBrowserClient({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    });
  } catch (error) {
    console.error("Failed to create Supabase client:", error);
    throw new Error("Supabase client initialization failed.");
  }
};

// Chat helpers
export async function getOrCreateConversation(
  supabase: SupabaseClient,
  itemId: string,
  type: "user-to-poster" | "user-to-security"
) {
  // Get current user ID
  const { data: userData, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw authErr;
  const userId = userData.user.id;

  // Check existing conversation for this user
  const { data: existing, error: selectErr } = await supabase
    .from("conversations")
    .select("*")
    .eq("item_id", itemId)
    .eq("type", type)
    .eq("creator_id", userId)
    .limit(1)
    .single();
  if (selectErr && selectErr.code !== "PGRST116") throw selectErr;
  if (existing) return existing;
  // Create new conversation with creator_id set to current user
  const { data, error: insertErr } = await supabase
    .from("conversations")
    .insert({
      item_id: itemId,
      type,
      creator_id: userId,
    })
    .select()
    .single();
  if (insertErr) throw insertErr;
  return data;
}

export async function sendMessage(
  supabase: SupabaseClient,
  conversationId: string,
  senderId: string,
  body: string,
  attachments: File[] = []
) {
  // Upload attachments and gather metadata
  const uploaded: Array<{ path: string; url: string }> = [];
  for (const file of attachments) {
    const filePath = `${conversationId}/${Date.now()}_${file.name.replace(
      /\s+/g,
      "_"
    )}`;
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from("chat-images")
      .upload(filePath, file);
    if (uploadErr) throw uploadErr;
    const { data: urlData } = supabase.storage
      .from("chat-images")
      .getPublicUrl(uploadData.path);
    uploaded.push({ path: uploadData.path, url: urlData.publicUrl });
  }
  // Insert message
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      body,
      attachments: uploaded,
    })
    .select()
    .single();
  if (error) throw error;

  // Create notification for recipient
  try {
    // Get conversation details to determine recipient
    const { data: conversation } = await supabase
      .from("conversations")
      .select(
        `
        *,
        item:items(id, title, user_id)
      `
      )
      .eq("id", conversationId)
      .single();

    if (conversation) {
      let recipientId: string | null = null;

      if (conversation.type === "user-to-poster") {
        // If sender is creator, recipient is item owner; if sender is item owner, recipient is creator
        recipientId =
          conversation.creator_id === senderId
            ? conversation.item.user_id
            : conversation.creator_id;
      } else if (conversation.type === "user-to-security") {
        // For security chats, if sender is not admin, notify admins; if sender is admin, notify creator
        const { data: senderProfile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", senderId)
          .single();

        if (senderProfile?.role === "admin") {
          recipientId = conversation.creator_id;
        } else {
          // Notify the first admin user found
          const { data: adminUsers } = await supabase
            .from("profiles")
            .select("id")
            .eq("role", "admin")
            .limit(1);
          if (adminUsers && adminUsers.length > 0) {
            recipientId = adminUsers[0].id;
          }
        }
      }

      // Only create notification if recipient is different from sender
      if (recipientId && recipientId !== senderId) {
        const { data: senderProfile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", senderId)
          .single();

        await supabase.from("notifications").insert({
          user_id: recipientId,
          item_id: conversation.item_id,
          type: "new_message",
          title: "New Message",
          message: `${
            senderProfile?.full_name || "Someone"
          } sent you a message about "${conversation.item.title}"`,
        });
      }
    }
  } catch (notificationError) {
    // Don't fail the message send if notification creation fails
    console.error("Failed to create message notification:", notificationError);
  }

  return data;
}

/**
 * Subscribe to new messages for a conversation via Supabase Realtime v2.
 * Returns a RealtimeChannel which can be unsubscribed via channel.unsubscribe().
 */
export function subscribeToMessages(
  supabase: SupabaseClient,
  conversationId: string,
  callback: (message: unknown) => void
): RealtimeChannel {
  // Create a unique channel name to avoid conflicts
  const channelName = `messages_${conversationId}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  try {
    // Create a Realtime channel for message inserts
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          console.log("New message received:", payload.new);
          callback(payload.new);
        }
      )
      .subscribe((status, err) => {
        console.log("Subscription status:", status);
        if (status === 'CHANNEL_ERROR') {
          console.error("Realtime subscription error:", status, err);
        }
      });

    return channel;
  } catch (error) {
    console.error("Error creating subscription:", error);
    // Return a dummy channel that can be safely unsubscribed
    return {
      unsubscribe: () => console.log("Dummy channel unsubscribed"),
    } as RealtimeChannel;
  }
}
