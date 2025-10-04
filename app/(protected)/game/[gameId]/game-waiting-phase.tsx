"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { markPlayerReady, declineGame, cancelGame } from "../../rooms/[roomCode]/actions";

interface GameWaitingPhaseProps {
  gameId: string;
  userId: string;
  isHost: boolean;
  templateCategory: string;
  initialParticipant: {
    is_ready: boolean;
  };
}

interface Participant {
  user_id: string;
  is_ready: boolean;
  user: {
    username: string;
  };
}

export function GameWaitingPhase({
  gameId,
  userId,
  isHost,
  templateCategory,
  initialParticipant
}: GameWaitingPhaseProps) {
  const [isReady, setIsReady] = useState(initialParticipant.is_ready);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30); // 30 second timeout
  const [canForceStart, setCanForceStart] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // Fetch initial participants
    const fetchParticipants = async () => {
      const { data } = await supabase
        .from("game_participants")
        .select(`
          user_id,
          is_ready,
          user:users!game_participants_user_id_fkey(username)
        `)
        .eq("game_id", gameId);

      const formattedParticipants = (data || []).map(p => ({
        user_id: p.user_id,
        is_ready: p.is_ready,
        user: Array.isArray(p.user) ? p.user[0] : p.user
      }));

      setParticipants(formattedParticipants);
    };

    fetchParticipants();

    // Subscribe to participant changes
    const channel = supabase
      .channel(`game_participants:${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_participants",
          filter: `game_id=eq.${gameId}`,
        },
        async () => {
          // Refetch participants when there's a change
          fetchParticipants();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  // Countdown timer for host
  useEffect(() => {
    if (!isHost) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setCanForceStart(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isHost]);

  // Subscribe to game status changes to navigate when game starts
  useEffect(() => {
    const supabase = createClient();

    const gameChannel = supabase
      .channel(`game_status:${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          if (payload.new.status === "playing") {
            console.log("Game started, navigating to game page");
            router.push(`/game/${gameId}`);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "games",
          filter: `id=eq.${gameId}`,
        },
        () => {
          console.log("Game was canceled, redirecting to rooms");
          // Don't redirect the host (they initiated the cancel)
          if (!isHost) {
            // Show a brief message and redirect non-host players
            alert("The host canceled the game.");
            router.push("/rooms");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(gameChannel);
    };
  }, [gameId, router, isHost]);

  const handleReady = async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      await markPlayerReady(gameId);
      setIsReady(true);
    } catch (error) {
      console.error("Error marking ready:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecline = async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      await declineGame(gameId);
      router.push("/rooms");
    } catch (error) {
      console.error("Error declining game:", error);
      setIsLoading(false);
    }
  };

  const handleForceStart = async () => {
    if (isLoading || !isHost) return;

    setIsLoading(true);
    try {
      const supabase = createClient();

      // Remove participants who aren't ready
      const { error: removeError } = await supabase
        .from("game_participants")
        .delete()
        .eq("game_id", gameId)
        .eq("is_ready", false);

      if (removeError) {
        console.error("Error removing unready participants:", removeError);
        throw new Error("Failed to remove unready participants");
      }

      // The trigger will automatically start the game when only ready participants remain
    } catch (error) {
      console.error("Error force starting game:", error);
      setIsLoading(false);
    }
  };

  const handleCancelGame = async () => {
    if (isLoading || !isHost) return;

    setIsLoading(true);
    try {
      const result = await cancelGame(gameId);
      router.push(`/rooms/${result.roomCode}`);
    } catch (error) {
      console.error("Error canceling game:", error);
      setIsLoading(false);
    }
  };

  const readyCount = participants.filter(p => p.is_ready).length;
  const totalCount = participants.length;

  return (
    <div className="flex-1 flex flex-col gap-8 w-full max-w-3xl mx-auto">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Story Ready Check</h1>
        <p className="text-muted-foreground">
          Category: {templateCategory}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Waiting for Players</CardTitle>
          <CardDescription>
            {readyCount} of {totalCount} players ready
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Participant list */}
            <div className="space-y-2">
              {participants.map((participant) => (
                <div key={participant.user_id} className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 dark:bg-gray-800">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      participant.is_ready ? "bg-green-500" : "bg-yellow-500"
                    }`}></div>
                    <span className="text-sm font-medium">
                      {Array.isArray(participant.user) ? participant.user[0]?.username : participant.user?.username}
                      {participant.user_id === userId && (
                        <span className="text-blue-600 dark:text-blue-400"> (You{isHost ? " - Host" : ""})</span>
                      )}
                    </span>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                    participant.is_ready
                      ? "bg-green-600 text-white"
                      : "bg-yellow-600 text-white"
                  }`}>
                    {participant.is_ready ? "Ready" : "Waiting"}
                  </span>
                </div>
              ))}
            </div>

            {/* Action buttons for non-host only */}
            {!isHost && !isReady && (
              <div className="flex gap-4 pt-4">
                <Button
                  onClick={handleReady}
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading ? "Getting Ready..." : "Ready to Play!"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDecline}
                  disabled={isLoading}
                >
                  Decline
                </Button>
              </div>
            )}

            {/* Visual status for ready non-host */}
            {!isHost && isReady && (
              <div className="text-center pt-4">
                <div className="inline-flex items-center gap-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg px-4 py-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">
                    You&apos;re ready! Waiting for others...
                  </span>
                </div>
              </div>
            )}

            {/* Status for host */}
            {isHost && (
              <div className="space-y-4 pt-4">
                <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      You&apos;re the Host
                    </span>
                  </div>
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    {readyCount === totalCount ? (
                      "All players are ready! Starting game..."
                    ) : (
                      `Waiting for ${totalCount - readyCount} more player${totalCount - readyCount === 1 ? '' : 's'} to be ready`
                    )}
                  </div>
                  {timeLeft > 0 && readyCount < totalCount && (
                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                      You can force start in {timeLeft}s
                    </div>
                  )}
                </div>

                <div className="text-center space-y-3">
                  {canForceStart && readyCount < totalCount && (
                    <div>
                      <Button
                        onClick={handleForceStart}
                        disabled={isLoading}
                        variant="outline"
                        size="sm"
                        className="border-orange-300 text-orange-800 hover:bg-orange-50 hover:text-orange-900 dark:border-orange-500 dark:text-orange-200 dark:hover:bg-orange-900/20 dark:hover:text-orange-100"
                      >
                        {isLoading ? "Starting..." : `Start with ${readyCount} Ready Player${readyCount === 1 ? '' : 's'}`}
                      </Button>
                      <div className="text-xs text-muted-foreground mt-1">
                        Unready players will be removed from this game
                      </div>
                    </div>
                  )}

                  <div>
                    <Button
                      onClick={handleCancelGame}
                      disabled={isLoading}
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                    >
                      {isLoading ? "Canceling..." : "Cancel Game"}
                    </Button>
                    <div className="text-xs text-muted-foreground mt-1">
                      Return everyone to the room lobby
                    </div>
                  </div>
                </div>

                {readyCount === totalCount && (
                  <div className="text-center">
                    <div className="inline-flex items-center gap-2 text-green-700 dark:text-green-300">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium">Starting game...</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}