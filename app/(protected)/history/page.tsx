import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function HistoryPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/auth/login");
  }

  // First, get all game IDs where user was a participant
  const { data: userGames } = await supabase
    .from("game_participants")
    .select("game_id")
    .eq("user_id", user.id);

  const gameIds = userGames?.map((g) => g.game_id) || [];

  // Then fetch completed stories for those games
  const { data: completedGames } = await supabase
    .from("completed_stories")
    .select(`
      *,
      game:games(
        id,
        created_at,
        template:story_templates(category),
        room:rooms(room_code)
      )
    `)
    .in("game_id", gameIds)
    .order("created_at", { ascending: false });

  return (
    <div className="flex-1 flex flex-col gap-8 w-full max-w-3xl mx-auto pb-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Story History</h1>
        <p className="text-muted-foreground mt-2">
          View all the hilarious stories you&apos;ve created
        </p>
      </div>

      {!completedGames || completedGames.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Stories Yet</CardTitle>
            <CardDescription>
              You haven&apos;t completed any stories yet. Join a room to get started!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/rooms">
              <Button className="w-full">Go to Rooms</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {completedGames.map((story) => (
            <Card key={story.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="capitalize">
                      {story.game.template.category}
                    </CardTitle>
                    <CardDescription>
                      Room: {story.game.room.room_code} • {" "}
                      {new Date(story.created_at).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  {story.images_generated && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                      ✨ With AI Art
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm line-clamp-3">{story.story_text}</p>
                <Link href={`/game/${story.game_id}`}>
                  <Button variant="outline" size="sm" className="w-full">
                    View Full Story
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
