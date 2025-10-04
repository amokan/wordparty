import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { WordSubmissionPhase } from "./word-submission-phase";
import { CompletedStoryView } from "./completed-story-view";
import { GameWaitingPhase } from "./game-waiting-phase";
import { HostLeftListener } from "@/components/host-left-listener";

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

  // Get total participant count for this game
  const { count: participantCount } = await supabase
    .from("game_participants")
    .select("*", { count: "exact", head: true })
    .eq("game_id", gameId);

  // For playing status, show word submission
  if (game.status === "playing") {
    return (
      <>
        <WordSubmissionPhase
          gameId={gameId}
          template={game.template}
          wordsAssigned={participant.words_assigned || []}
          totalParticipants={participantCount || 1}
        />
        <HostLeftListener
          gameId={gameId}
          hostId={game.room.host_id}
          roomCode={game.room.room_code}
          userId={user.id}
        />
      </>
    );
  }

  // For finished status, show completed story
  if (game.status === "finished") {
    return (
      <>
        <CompletedStoryView
          gameId={gameId}
          roomCode={game.room.room_code}
          isHost={game.room.host_id === user.id}
        />
        <HostLeftListener
          gameId={gameId}
          hostId={game.room.host_id}
          roomCode={game.room.room_code}
          userId={user.id}
        />
      </>
    );
  }

  // For waiting status, show ready check
  if (game.status === "waiting") {
    return (
      <>
        <GameWaitingPhase
          gameId={gameId}
          userId={user.id}
          isHost={game.room.host_id === user.id}
          templateCategory={game.template?.category || "Unknown"}
          initialParticipant={participant}
        />
        <HostLeftListener
          gameId={gameId}
          hostId={game.room.host_id}
          roomCode={game.room.room_code}
          userId={user.id}
        />
      </>
    );
  }

  // Other status (fallback)
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
