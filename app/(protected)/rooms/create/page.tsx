import { createRoom } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function CreateRoomPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 w-full max-w-md mx-auto">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Create a New Room</CardTitle>
          <CardDescription>
            Start a new game room and invite your friends to join
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>When you create a room, you will:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Get a unique 8-character room code</li>
              <li>Become the host of the room</li>
              <li>Be able to start games and manage the room</li>
            </ul>
          </div>

          <form action={createRoom} className="space-y-4">
            <Button type="submit" size="lg" className="w-full">
              Create Room
            </Button>
          </form>

          <div className="text-center">
            <Link href="/rooms" className="text-sm text-muted-foreground hover:underline">
              Back to rooms
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
