"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { X } from "lucide-react";

interface GameInvitationToastProps {
  userId: string;
}

interface GameInvitation {
  gameId: string;
  roomCode: string;
  category: string;
}

export function GameInvitationToast({ userId }: GameInvitationToastProps) {
  const [invitation, setInvitation] = useState<GameInvitation | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();

    // Subscribe to when the user is added to a new game
    const channel = supabase
      .channel(`game_invitations:${userId}`)
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

          // Don't show toast if already on the game page
          if (pathname.startsWith(`/game/${gameId}`)) {
            return;
          }

          // Fetch game details for the toast
          const { data: game } = await supabase
            .from("games")
            .select(`
              id,
              status,
              room:rooms(room_code),
              template:story_templates(category)
            `)
            .eq("id", gameId)
            .single();

          if (game && game.status === "waiting") {
            const room = Array.isArray(game.room) ? game.room[0] : game.room;
            const template = Array.isArray(game.template) ? game.template[0] : game.template;

            setInvitation({
              gameId,
              roomCode: room?.room_code || "Unknown",
              category: template?.category || "Unknown"
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, pathname]);

  const handleJoinGame = () => {
    if (invitation) {
      router.push(`/game/${invitation.gameId}`);
      setInvitation(null);
    }
  };

  const handleDismiss = () => {
    setInvitation(null);
  };

  if (!invitation) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 w-80">
      <Card className="shadow-lg border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-sm text-blue-900 dark:text-blue-100">
                🎉 New Game Started!
              </CardTitle>
              <CardDescription className="text-blue-700 dark:text-blue-300">
                Room {invitation.roomCode} • {invitation.category}
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-6 w-6 p-0 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex gap-2">
            <Button
              onClick={handleJoinGame}
              size="sm"
              className="flex-1"
            >
              Join Game
            </Button>
            <Button
              variant="outline"
              onClick={handleDismiss}
              size="sm"
            >
              Maybe Later
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}