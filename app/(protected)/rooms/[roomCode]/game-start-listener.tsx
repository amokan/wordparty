"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface GameStartListenerProps {
  roomId: string;
  userId: string;
}

export function GameStartListener({ roomId, userId }: GameStartListenerProps) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // Subscribe to new games in this room
    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_participants",
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          // When user is added to a game, navigate to it
          const gameId = payload.new.game_id;
          if (gameId) {
            router.push(`/game/${gameId}`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, userId, router]);

  return null;
}
