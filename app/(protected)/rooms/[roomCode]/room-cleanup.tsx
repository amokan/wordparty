"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePathname } from "next/navigation";

interface RoomCleanupProps {
  roomId: string;
  userId: string;
  roomCode: string;
}

export function RoomCleanup({ roomId, userId, roomCode }: RoomCleanupProps) {
  const pathname = usePathname();
  const cleanupExecuted = useRef(false);

  useEffect(() => {
    const supabase = createClient();

    // Cleanup function when component unmounts (user navigates away)
    return () => {
      // Only cleanup if navigating away from this specific room page
      // and we haven't already executed cleanup
      // DON'T cleanup if navigating to a game (they're still "in" the room)
      const currentPath = window.location.pathname;
      const isLeavingRoom = !currentPath.includes(`/rooms/${roomCode}`);
      const isGoingToGame = currentPath.includes('/game/');

      if (isLeavingRoom && !isGoingToGame && !cleanupExecuted.current) {
        cleanupExecuted.current = true;

        const cleanup = async () => {
          await supabase
            .from("room_participants")
            .delete()
            .eq("room_id", roomId)
            .eq("user_id", userId);
        };

        cleanup();
      }
    };
  }, [roomId, userId, roomCode, pathname]);

  return null;
}
