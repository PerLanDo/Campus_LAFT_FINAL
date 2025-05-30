"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { getOrCreateConversation } from "@/lib/supabase/client";

interface ChatInitiatorProps {
  itemId: string;
  turnInToSecurity?: boolean;
}

export default function ChatInitiator({
  itemId,
  turnInToSecurity,
}: ChatInitiatorProps) {
  const supabase = createClientComponentClient();
  const router = useRouter();

  const handleClick = async () => {
    const convType: "user-to-poster" | "user-to-security" = turnInToSecurity
      ? "user-to-security"
      : "user-to-poster";
    try {
      const conv = await getOrCreateConversation(supabase, itemId, convType);
      router.push(`/chat/${conv.id}`);
    } catch (err: unknown) {
      console.error(
        "Chat initiation error:",
        err,
        JSON.stringify(err),
        (err as Error)?.message
      );
      alert("Failed to start chat. Please try again or contact support.");
    }
  };

  return (
    <button
      onClick={handleClick}
      className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md"
    >
      {turnInToSecurity ? "Message Admin" : "Message Poster"}
    </button>
  );
}
