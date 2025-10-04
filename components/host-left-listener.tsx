"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { X } from "lucide-react";

interface HostLeftListenerProps {
  gameId: string;
  hostId: string;
  roomCode: string;
  userId: string;
}

export function HostLeftListener({ gameId, hostId, roomCode, userId }: HostLeftListenerProps) {
  const [showHostLeftNotification, setShowHostLeftNotification] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Don't show notification for the host themselves
    if (userId === hostId) return;

    const supabase = createClient();

    // Subscribe to when host is removed from game participants
    const channel = supabase
      .channel(`host_left:${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "game_participants",
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          // Check if the deleted participant was the host
          if (payload.old.user_id === hostId) {
            setShowHostLeftNotification(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, hostId, userId]);

  const handleReturnToRoom = () => {
    router.push(`/rooms/${roomCode}`);
    setShowHostLeftNotification(false);
  };

  const handleDismiss = () => {
    setShowHostLeftNotification(false);
  };

  if (!showHostLeftNotification) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 w-80">
      <Card className="shadow-lg border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-sm text-orange-900 dark:text-orange-100">
                🚪 Host Left Game
              </CardTitle>
              <CardDescription className="text-orange-700 dark:text-orange-300">
                The game host has left the session
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-6 w-6 p-0 text-orange-600 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-200"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex gap-2">
            <Button
              onClick={handleReturnToRoom}
              size="sm"
              className="flex-1"
            >
              Return to Room
            </Button>
            <Button
              variant="outline"
              onClick={handleDismiss}
              size="sm"
            >
              Stay Here
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}