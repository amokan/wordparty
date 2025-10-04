import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RoomCodeCard } from "./room-code-card";
import { RoomCleanup } from "./room-cleanup";
import { StartGameForm } from "./start-game-form";
import { GameStartListener } from "./game-start-listener";
import { ParticipantsList } from "./participants-list";
import { leaveRoom } from "./actions";

interface RoomLobbyPageProps {
  params: Promise<{
    roomCode: string;
  }>;
}

export default async function RoomLobbyPage({ params }: RoomLobbyPageProps) {
  const { roomCode } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/auth/login");
  }

  // Fetch room details
  const { data: room } = await supabase
    .from("rooms")
    .select(`
      *,
      host:users!rooms_host_id_fkey(username, avatar_url)
    `)
    .eq("room_code", roomCode)
    .single();

  if (!room) {
    return redirect("/rooms");
  }

  // Check if user is a participant
  const { data: participant } = await supabase
    .from("room_participants")
    .select("*")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .single();

  // If not a participant, add them
  if (!participant) {
    await supabase.from("room_participants").insert({
      room_id: room.id,
      user_id: user.id,
    });
  }

  // Fetch all participants
  const { data: participantData } = await supabase
    .from("room_participants")
    .select(`
      user:users!room_participants_user_id_fkey(id, username, avatar_url)
    `)
    .eq("room_id", room.id);

  const participants = participantData?.map(p => ({
    user: Array.isArray(p.user) ? p.user[0] : p.user
  }));

  // Fetch available categories for game creation
  const { data: categoryData } = await supabase
    .from("story_templates")
    .select("category")
    .eq("active", true);

  const categories = Array.from(
    new Set(categoryData?.map((t) => t.category) || [])
  ).sort();

  // Check if user has an active game in this room
  const { data: activeGame } = await supabase
    .from("games")
    .select(`
      id,
      status,
      template:story_templates(category)
    `)
    .eq("room_id", room.id)
    .in("status", ["waiting", "playing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Check if user is in the active game
  let userInActiveGame = false;
  if (activeGame) {
    const { data: gameParticipant } = await supabase
      .from("game_participants")
      .select("user_id")
      .eq("game_id", activeGame.id)
      .eq("user_id", user.id)
      .single();

    userInActiveGame = !!gameParticipant;
  }

  const isHost = room.host_id === user.id;

  return (
    <div className="flex-1 flex flex-col gap-8 w-full max-w-3xl mx-auto">
      <RoomCleanup roomId={room.id} userId={user.id} roomCode={roomCode} />
      <GameStartListener roomId={room.id} userId={user.id} />
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Room {roomCode}</h1>
          <p className="text-muted-foreground">
            Hosted by {room.host?.username || "Unknown"}
          </p>
        </div>
        <form action={leaveRoom.bind(null, room.id)}>
          <Button variant="outline" type="submit">Leave Room</Button>
        </form>
      </div>

      {/* Game in Progress Alert */}
      {activeGame && userInActiveGame && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="text-blue-800 dark:text-blue-200 flex items-center gap-2">
              {activeGame.status === "waiting" ? "🎯 Game Starting" : "🎮 Game in Progress"}
            </CardTitle>
            <CardDescription className="text-blue-700 dark:text-blue-300">
              {activeGame.status === "waiting"
                ? "Waiting for players to be ready"
                : "You have a game in progress"
              }
              {(() => {
                if (!activeGame.template) return '';
                const template = Array.isArray(activeGame.template) ? activeGame.template[0] : activeGame.template;
                return template?.category ? ` • ${template.category}` : '';
              })()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <a href={`/game/${activeGame.id}`}>
                {activeGame.status === "waiting" ? "Join Game Lobby" : "Continue Playing"}
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <RoomCodeCard roomCode={roomCode} />

        <ParticipantsList
          roomId={room.id}
          hostId={room.host_id}
          initialParticipants={participants || []}
        />
      </div>

      {isHost ? (
        <StartGameForm roomId={room.id} categories={categories} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1">
              Waiting for Host
              <span className="inline-flex">
                <span className="animate-pulse">.</span>
                <span className="animate-pulse animation-delay-200">.</span>
                <span className="animate-pulse animation-delay-400">.</span>
              </span>
            </CardTitle>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
