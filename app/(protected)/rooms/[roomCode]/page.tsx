import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

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
    .eq("is_active", true)
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

  const isHost = room.host_id === user.id;

  return (
    <div className="flex-1 flex flex-col gap-8 w-full max-w-3xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Room {roomCode}</h1>
          <p className="text-muted-foreground">
            Hosted by {room.host?.username || "Unknown"}
          </p>
        </div>
        <Link href="/rooms">
          <Button variant="outline">Leave Room</Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Room Code</CardTitle>
            <CardDescription>Share this code with friends</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-mono font-bold tracking-wider">
              {roomCode}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Players</CardTitle>
            <CardDescription>
              {participants?.length || 0} {participants?.length === 1 ? "player" : "players"} in lobby
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {participants?.map((p) => (
                <div key={p.user?.id} className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    {p.user?.username?.[0]?.toUpperCase() || "?"}
                  </div>
                  <span className="text-sm">
                    {p.user?.username || "Unknown"}
                    {p.user?.id === room.host_id && (
                      <span className="ml-2 text-xs text-muted-foreground">(Host)</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {isHost && (
        <Card>
          <CardHeader>
            <CardTitle>Start a Game</CardTitle>
            <CardDescription>
              As the host, you can start a new game when ready
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="lg" className="w-full" disabled>
              Start Game (Coming Soon)
            </Button>
          </CardContent>
        </Card>
      )}

      {!isHost && (
        <Card>
          <CardHeader>
            <CardTitle>Waiting for Host</CardTitle>
            <CardDescription>
              The host will start the game when everyone is ready
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
