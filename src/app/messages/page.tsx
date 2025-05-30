"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Image from "next/image";
import Link from "next/link";

// Function to generate a unique 4-digit identifier from UUID
function generateItemId(uuid: string): string {
  // Take a portion of the UUID and convert to a 4-digit number
  const hash = uuid.replace(/-/g, "").substring(0, 8);
  const num = parseInt(hash, 16) % 10000;
  return num.toString().padStart(4, "0");
}

interface Conversation {
  id: string;
  item_id: string;
  type: string;
  creator_id: string;
  item: {
    id: string;
    title: string;
    user_id: string;
    turn_in_to_security?: boolean;
  };
  other_participant?: {
    id: string;
    full_name: string;
    avatar_url: string;
  };
}

export default function MessagesPage() {
  const supabase = createClientComponentClient();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  useEffect(() => {
    async function fetchConversations() {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth");
        return;
      }
      setUserId(user.id);

      // Fetch all conversations where the user is a participant (creator or item owner or admin for security)
      // 1. As creator
      const { data: createdConversations, error: createdError } = await supabase
        .from("conversations")
        .select(
          `
          id, 
          item_id, 
          type, 
          creator_id,
          item:items(id, title, user_id, turn_in_to_security)
        `
        )
        .eq("creator_id", user.id);

      // 2. As item owner (for user-to-poster)
      const { data: receivedConversations, error: receivedError } = await supabase
          .from("conversations")
          .select(
            `
          id, 
          item_id, 
          type, 
          creator_id,
          item:items!inner(id, title, user_id, turn_in_to_security)
        `
          )
          .eq("item.user_id", user.id)
          .neq("creator_id", user.id); // Exclude conversations user already created

      // 3. As admin for security chats
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      let securityConversations: Conversation[] = [];
      if (userProfile?.role === "admin") {
        const { data: adminConversations } = await supabase
          .from("conversations")
          .select(
            `
            id, 
            item_id, 
            type, 
            creator_id,
            item:items(id, title, user_id, turn_in_to_security)
          `
          )
          .eq("type", "user-to-security")
          .neq("creator_id", user.id); // Exclude conversations user already created

        securityConversations = (adminConversations || []).map((conv) => {
          const item = Array.isArray(conv.item) ? conv.item[0] : conv.item;
          return { ...conv, item };
        });
      }

      // Combine all conversations and remove duplicates
      const allConversations = [
        ...(createdConversations || []),
        ...(receivedConversations || []),
        ...securityConversations,
      ];

      // Remove duplicates based on conversation ID
      const uniqueConversations = allConversations
        .filter((conv) => {
          const item = Array.isArray(conv.item) ? conv.item[0] : conv.item;
          return (
            item &&
            typeof item.id === "string" &&
            typeof item.title === "string" &&
            typeof item.user_id === "string"
          );
        })
        .map((conv) => {
          const item = Array.isArray(conv.item) ? conv.item[0] : conv.item;
          return { ...conv, item };
        })
        .filter(
          (conv, index, self): conv is Conversation =>
            !!conv &&
            typeof conv.id === "string" &&
            conv.item &&
            typeof conv.item.id === "string" &&
            typeof conv.item.title === "string" &&
            typeof conv.item.user_id === "string" &&
            index === self.findIndex((c) => c && c.id === conv.id)
      );

      const error = createdError || receivedError;
      if (error) {
        console.error("Error fetching conversations:", error);
        setConversations([]);
      } else {
        // For each conversation, determine the other participant and get their profile
        const conversationsWithParticipants = await Promise.all(
          uniqueConversations.map(
            async (conv: Conversation) => {
              let otherParticipantId: string;
              const isCurrentUserCreator = conv.creator_id === user.id;

              if (conv.type === "user-to-poster") {
                // Extract the first item from the array (Supabase returns it as an array)
                const item = Array.isArray(conv.item) ? conv.item[0] : conv.item;
                if (!item) return null; // Skip if no item found

                if (isCurrentUserCreator) {
                  // Current user created the conversation, so they contacted the item owner
                  otherParticipantId = item.user_id;
                } else {
                  // Current user is the item owner, so the other participant is the creator
                  otherParticipantId = conv.creator_id;
                }
              } else {
                // user-to-security conversation
                if (isCurrentUserCreator) {
                  // Current user contacted security - get a security user (admin)
                  const { data: securityUsers } = await supabase
                    .from("profiles")
                    .select("id, full_name, avatar_url")
                    .eq("role", "admin")
                    .limit(1);

                  if (securityUsers && securityUsers.length > 0) {
                    otherParticipantId = securityUsers[0].id;
                  } else {
                    return null; // Skip if no security user found
                  }
                } else {
                  // Current user is admin, so the other participant is the creator
                  otherParticipantId = conv.creator_id;
                }
              }

              // Get the other participant's profile
              const { data: profile } = await supabase
                .from("profiles")
                .select("id, full_name, avatar_url")
                .eq("id", otherParticipantId)
                .single();

              return {
                ...conv,
                item: Array.isArray(conv.item) ? conv.item[0] : conv.item,
                other_participant: profile,
              } as Conversation;
            }
          )
        );
        setConversations(
          conversationsWithParticipants.filter(
            (conv: Conversation | null): conv is Conversation => conv !== null
          )
        );
      }
      setLoading(false);
    }
    fetchConversations();
  }, [supabase, router]);

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!userId) return null;

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Your Messages</h1>
      {conversations.length === 0 ? (
        <div className="text-gray-500">No conversations yet.</div>
      ) : (
        <ul className="space-y-4">
          {conversations.map((conv) => {
            // Show the other participant
            const other = conv.other_participant;
            if (!other) return null;
            return (
              <li
                key={conv.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-center gap-4"
              >
                <Image
                  src={other.avatar_url || "/file.svg"}
                  alt={other.full_name}
                  width={48}
                  height={48}
                  className="rounded-full object-cover"
                />
                <div className="flex-1">
                  <div className="font-semibold text-lg">{other.full_name}</div>{" "}
                  <div className="text-sm text-gray-500">
                    {conv.type === "user-to-poster"
                      ? `About item: ${
                          conv.item?.title || conv.item_id
                        }(${generateItemId(conv.item?.id || conv.item_id)})`
                      : "Chat with Security"}
                  </div>
                </div>
                <Link
                  href={`/chat/${conv.id}`}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md"
                >
                  {conv.item?.turn_in_to_security ? "Message Admin" : "View Chat"}
                </Link>
                <button
                  onClick={async (e) => {
                    e.stopPropagation(); // Prevent navigating to chat page
                    if (confirm("Are you sure you want to delete this conversation?")) {
                      const { error } = await supabase
                        .from("conversations")
                        .delete()
                        .eq("id", conv.id);
                      if (error) {
                        console.error("Error deleting conversation:", error);
                        alert("Failed to delete conversation.");
                      } else {
                        // Remove conversation from state
                        setConversations(
                          conversations.filter((c) => c.id !== conv.id)
                        );
                      }
                    }
                  }}
                  className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-600"
                  aria-label="Delete Conversation"
                >
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}