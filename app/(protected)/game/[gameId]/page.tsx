import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { WordSubmissionPhase } from "./word-submission-phase";
import { CompletedStoryView } from "./completed-story-view";

interface GamePageProps {
  params: Promise<{
    gameId: string;
  }>;
}

export default async function GamePage({ params }: GamePageProps) {
  const { gameId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/auth/login");
  }

  // Fetch game details
  const { data: game } = await supabase
    .from("games")
    .select(`
      *,
      room:rooms(room_code, host_id),
      template:story_templates(*)
    `)
    .eq("id", gameId)
    .single();

  if (!game) {
    return redirect("/rooms");
  }

  // Verify user is a participant
  const { data: participant } = await supabase
    .from("game_participants")
    .select("*")
    .eq("game_id", gameId)
    .eq("user_id", user.id)
    .single();

  if (!participant) {
    return redirect("/rooms");
  }

  // For playing status, show word submission
  if (game.status === "playing") {
    return (
      <WordSubmissionPhase
        gameId={gameId}
        template={game.template}
        wordsAssigned={participant.words_assigned || []}
      />
    );
  }

  // For finished status, show completed story
  if (game.status === "finished") {
    return (
      <CompletedStoryView
        gameId={gameId}
        roomCode={game.room.room_code}
        isHost={game.room.host_id === user.id}
      />
    );
  }

  // Waiting or other status
  return (
    <div className="flex-1 flex flex-col gap-8 w-full max-w-3xl mx-auto">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Game</h1>
        <p className="text-muted-foreground">
          Status: {game.status}
        </p>
        <p className="text-sm text-muted-foreground mt-4">
          Category: {game.template?.category}
        </p>
      </div>
    </div>
  );
}
