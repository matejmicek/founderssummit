"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";

interface Message {
  id: string;
  match_id: string;
  team_id: string;
  content: string;
  sequence: number;
}

export function useRealtimeMessages(matchId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (!matchId) return;

    const supabase = createBrowserClient();

    // Initial fetch
    supabase
      .from("messages")
      .select("*")
      .eq("match_id", matchId)
      .order("sequence")
      .then(({ data }) => setMessages(data || []));

    // Subscribe to new messages
    const channel = supabase
      .channel(`messages-${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === payload.new.id);
            if (exists) return prev;
            return [...prev, payload.new as Message].sort(
              (a, b) => a.sequence - b.sequence
            );
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  return { messages };
}
