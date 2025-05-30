"use client";

import React, { useState, useEffect, useRef, ChangeEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  sendMessage,
  subscribeToMessages,
  ExtendedMessage,
  MessageAttachment,
} from "@/lib/supabase/client";
import Image from "next/image";

export default function ChatPage() {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const { conversationId } = useParams();
  const convId = Array.isArray(conversationId)
    ? conversationId[0]
    : conversationId;
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [userMap, setUserMap] = useState<{
    [id: string]: { full_name: string; role: string };
  }>({});
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    full_name: string;
    role: string;
  } | null>(null);
  const [partner, setPartner] = useState<{
    id: string;
    full_name: string;
    role: string;
  } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null); // Load initial messages & subscribe to realtime
  useEffect(() => {
    if (!convId || typeof convId !== "string" || convId.trim() === "") return;

    // Fetch existing messages
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });

      if (error) console.error(error);
      else setMessages(data || []);
    };

    fetchMessages();

    // Set up polling as fallback for real-time (every 2 seconds)
    const pollInterval = setInterval(fetchMessages, 2000);

    // Try to set up real-time subscription (with fallback)
    let subscription: { unsubscribe: () => void } | null = null;
    try {
      subscription = subscribeToMessages(supabase, convId, (msg) => {
        console.log("Received new message:", msg);
        setMessages((prev) => {
          // Check if message already exists to avoid duplicates
          const messageExists = prev.some(
            (m) => m.id === (msg as ExtendedMessage).id
          );
          if (messageExists) return prev;
          return [...prev, msg as ExtendedMessage];
        });
      });
    } catch (error) {
      console.error(
        "Failed to subscribe to messages, using polling fallback:",
        error
      );
    }

    return () => {
      clearInterval(pollInterval);
      if (subscription && typeof subscription.unsubscribe === "function") {
        try {
          subscription.unsubscribe();
        } catch (error) {
          console.error("Error unsubscribing:", error);
        }
      }
    };
  }, [convId, supabase]);
  // Fetch user info and conversation info
  useEffect(() => {
    if (!convId) return;
    const fetchUsersAndConversation = async () => {
      // 1. Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // 2. Get conversation info with item details
      const { data: conv } = await supabase
        .from("conversations")
        .select(
          `
          *,
          item:items(id, title, user_id)
        `
        )
        .eq("id", convId)
        .single();
      if (!conv) return;

      // 3. Determine who the other participant is
      let otherParticipantId: string;
      if (conv.type === "user-to-poster") {
        // If current user is creator, other participant is item owner
        // If current user is item owner, other participant is creator
        otherParticipantId =
          conv.creator_id === user.id ? conv.item.user_id : conv.creator_id;
      } else {
        // For security chats, get admin user
        const { data: adminUsers } = await supabase
          .from("profiles")
          .select("id")
          .eq("role", "admin")
          .limit(1);

        if (adminUsers && adminUsers.length > 0) {
          otherParticipantId = adminUsers[0].id;
        } else {
          console.error("No admin user found for security chat");
          return;
        }
      }

      // 4. Get all user IDs (participants + all message senders/recipients)
      const userIds = new Set([
        conv.creator_id,
        conv.item.user_id,
        otherParticipantId,
      ]);
      messages.forEach((msg) => {
        userIds.add(msg.sender_id);
        if (msg.recipient_id) userIds.add(msg.recipient_id);
      });

      // 5. Fetch user info
      const { data: users } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .in("id", Array.from(userIds));
      const map: { [id: string]: { full_name: string; role: string } } = {};
      users?.forEach((u) => {
        map[u.id] = { full_name: u.full_name, role: u.role };
      });
      setUserMap(map);

      // 6. Set partner
      setPartner(
        map[otherParticipantId]
          ? {
              id: otherParticipantId,
              full_name: map[otherParticipantId].full_name || "",
              role: map[otherParticipantId].role,
            }
          : null
      );
      setCurrentUser(
        map[user.id]
          ? {
              id: user.id,
              full_name: map[user.id].full_name || user.email || "",
              role: map[user.id].role,
            }
          : { id: user.id, full_name: user.email || "", role: "user" }
      );
    };
    fetchUsersAndConversation();
  }, [convId, messages, supabase]);

  // Mark messages as seen
  useEffect(() => {
    if (!convId || !currentUser) return;
    const unseen = messages.filter(
      (msg: ExtendedMessage) =>
        msg.recipient_id === currentUser.id && !msg.read_at
    );
    if (unseen.length > 0) {
      const ids = unseen.map((msg: ExtendedMessage) => msg.id);
      supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .in("id", ids);
    }
  }, [messages, convId, currentUser, supabase]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const list = Array.from(e.target.files).slice(0, 5);
    setFiles(list);
    setPreviews(list.map((f) => URL.createObjectURL(f)));
  };

  const handleSend = async () => {
    if (!convId) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/auth");
      return;
    }
    try {
      await sendMessage(supabase, convId, user.id, body, files);
      setBody("");
      setFiles([]);
      setPreviews([]);
    } catch (err: unknown) {
      console.error(
        "Send message error:",
        err,
        JSON.stringify(err),
        (err as Error)?.message
      );
    }
  };

  // If convId missing, show error UI
  if (!convId) {
    return <div className="p-4 text-center">Invalid conversation ID</div>;
  }

  // Get item info from conversation (if available)
  const [itemInfo, setItemInfo] = useState<any>(null);
  useEffect(() => {
    if (!convId) return;
    const fetchItemInfo = async () => {
      const { data: conv } = await supabase
        .from("conversations")
        .select(
          `*, item:items(id, title, description, image_url)`
        )
        .eq("id", convId)
        .single();
      if (conv && conv.item) setItemInfo(conv.item);
    };
    fetchItemInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId]);

  return (
    <div className="flex flex-col h-full p-0 sm:p-4 bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-950 dark:to-indigo-950 rounded-lg shadow-lg max-w-3xl mx-auto">
      {/* Item info at the top */}
      {itemInfo && (
        <div className="flex items-center gap-4 p-4 border-b bg-white/80 dark:bg-gray-900/80 rounded-t-lg shadow-sm sticky top-0 z-10">
          {itemInfo.image_url && (
            <div className="w-16 h-16 relative flex-shrink-0">
              <Image
                src={itemInfo.image_url}
                alt={itemInfo.title}
                fill
                sizes="64px"
                className="object-cover rounded-lg border"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-bold text-lg truncate text-indigo-700 dark:text-indigo-300">{itemInfo.title}</div>
            {itemInfo.description && (
              <div className="text-sm text-gray-600 dark:text-gray-300 truncate">{itemInfo.description}</div>
            )}
          </div>
        </div>
      )}
      {/* Chat header with partner info */}
      <div className="chat-header mb-2 px-4 pt-4">
        {partner && (
          <div className="text-sm text-gray-700 dark:text-gray-200">
            Chatting with: <strong>{partner.full_name}</strong>
            {partner.role === "admin" && (
              <span className="ml-2 badge bg-red-500 text-white px-2 py-1 rounded">Admin</span>
            )}
            {partner.role === "security" && (
              <span className="ml-2 badge bg-blue-500 text-white px-2 py-1 rounded">Security</span>
            )}
          </div>
        )}
      </div>
      {/* Chat area */}
      <div className="flex-1 overflow-auto px-2 py-2 sm:px-6 sm:py-4 space-y-2 bg-white/60 dark:bg-gray-900/60 rounded-lg">
        {messages.map((msg: ExtendedMessage) => {
          const isSender = msg.sender_id === currentUser?.id;
          return (
            <div
              key={msg.id}
              className={`flex ${isSender ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[70%] px-4 py-2 rounded-2xl shadow-md text-sm break-words
                  ${isSender
                    ? "bg-indigo-500 text-white rounded-br-md"
                    : "bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md"
                  }
                `}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">
                    {userMap[msg.sender_id]?.full_name || msg.sender_id}
                  </span>
                  {userMap[msg.sender_id]?.role === "admin" && (
                    <span className="ml-1 badge bg-red-500 text-white px-1 rounded">Admin</span>
                  )}
                  {userMap[msg.sender_id]?.role === "security" && (
                    <span className="ml-1 badge bg-blue-500 text-white px-1 rounded">Security</span>
                  )}
                  <span className="ml-auto text-xs text-gray-300 dark:text-gray-400">
                    {new Date(msg.created_at).toLocaleTimeString()}
                  </span>
                  {isSender && msg.read_at && (
                    <span className="ml-2 text-green-300 text-xs">Seen</span>
                  )}
                </div>
                <div>{msg.body}</div>
                {msg.attachments?.map((att: MessageAttachment, idx: number) => (
                  <div key={idx} className="mt-2 max-h-40 relative w-full h-40">
                    <Image
                      src={att.url}
                      alt="attachment"
                      fill
                      sizes="(max-width: 600px) 100vw"
                      className="object-contain rounded-lg border"
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {/* Message input area */}
      <div className="border-t pt-4 px-4 bg-white/80 dark:bg-gray-900/80 rounded-b-lg">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type your message..."
          className="w-full p-2 border rounded mb-2 dark:bg-gray-700 dark:text-white resize-none focus:ring-2 focus:ring-indigo-400"
          rows={3}
        />
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileChange}
          className="mb-2"
        />
        <div className="flex space-x-2 mb-2">
          {previews.map((url, idx) => (
            <div key={idx} className="h-16 w-16 relative">
              <Image
                src={url}
                alt="preview"
                fill
                sizes="64px"
                className="object-cover rounded-lg border"
              />
            </div>
          ))}
        </div>
        <button
          onClick={handleSend}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded shadow-md w-full sm:w-auto"
        >
          Send
        </button>
      </div>
    </div>
  );
}
