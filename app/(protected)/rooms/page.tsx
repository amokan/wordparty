import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createRoom } from "./create/actions";
import { joinRoom } from "./join-room-action";

export default async function RoomsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/auth/login");
  }

  // Fetch user's active rooms
  const { data: rooms } = await supabase
    .from("rooms")
    .select(`
      *,
      room_participants!inner(user_id),
      host:users!rooms_host_id_fkey(username)
    `)
    .eq("room_participants.user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="flex-1 flex flex-col gap-8 w-full">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Your Rooms</h1>
          <p className="text-muted-foreground">Create a new room or join an existing one to create stories</p>
        </div>
        <form action={createRoom}>
          <Button size="lg" type="submit">Create Room</Button>
        </form>
      </div>

      {rooms && rooms.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <Link key={room.id} href={`/rooms/${room.room_code}`}>
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardHeader>
                  <CardTitle className="flex justify-between items-center">
                    <span>Room {room.room_code}</span>
                    {room.host_id === user.id && (
                      <span className="text-xs font-normal text-muted-foreground">Host</span>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Created by {room.host?.username || "Unknown"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Click to enter room
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No Active Rooms</CardTitle>
            <CardDescription>
              Create a new room to start creating stories with friends
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Join a Room</CardTitle>
            <CardDescription>
              Have a room code? Enter it below to join
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={joinRoom} className="flex gap-2">
              <Input
                name="roomCode"
                placeholder="Enter room code"
                required
                maxLength={6}
                style={{ textTransform: 'uppercase' }}
              />
              <Button type="submit">Join</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
