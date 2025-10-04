"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Participant {
  user: {
    id: string;
    username: string;
    avatar_url?: string;
  };
}

interface ParticipantsListProps {
  roomId: string;
  hostId: string;
  initialParticipants: Participant[];
}

export function ParticipantsList({ roomId, hostId, initialParticipants }: ParticipantsListProps) {
  const [participants, setParticipants] = useState<Participant[]>(initialParticipants);

  useEffect(() => {
    const supabase = createClient();

    // Subscribe to room participants changes
    const channel = supabase
      .channel(`room_participants:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to all events (INSERT, UPDATE, DELETE)
          schema: "public",
          table: "room_participants",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          console.log("Participants change:", payload);

          // Refetch all participants when there's a change
          const { data: participantData } = await supabase
            .from("room_participants")
            .select(`
              user:users!room_participants_user_id_fkey(id, username, avatar_url)
            `)
            .eq("room_id", roomId);

          const updatedParticipants = participantData?.map(p => ({
            user: Array.isArray(p.user) ? p.user[0] : p.user
          })) || [];

          setParticipants(updatedParticipants);
        }
      )
      .subscribe((status) => {
        console.log("Participants subscription status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Players</CardTitle>
        <CardDescription>
          {participants.length} {participants.length === 1 ? "player" : "players"} in lobby
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {participants.map((p) => (
            <div key={p.user?.id} className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                {p.user?.username?.[0]?.toUpperCase() || "?"}
              </div>
              <span className="text-sm">
                {p.user?.username || "Unknown"}
                {p.user?.id === hostId && (
                  <span className="ml-2 text-xs text-muted-foreground">(Host)</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}