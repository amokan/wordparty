"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";

interface GlobalGameListenerProps {
  userId: string;
}

export function GlobalGameListener({ userId }: GlobalGameListenerProps) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();

    // Subscribe to when the user is added to any game
    const channel = supabase
      .channel(`user_games:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_participants",
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          const gameId = payload.new.game_id;
          if (gameId) {
            // Only navigate if we're not already on a game page
            if (!pathname.startsWith(`/game/${gameId}`)) {
              console.log(`Navigating to game ${gameId} from global listener`);
              router.push(`/game/${gameId}`);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log("Global game listener status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, router, pathname]);

  return null;
}