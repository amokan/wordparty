"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function leaveRoom(roomId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Remove user from room participants
  const { error } = await supabase
    .from("room_participants")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error leaving room:", error);
    throw new Error("Failed to leave room");
  }

  redirect("/rooms");
}

export async function startGame(roomId: string, category: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  // Verify user is the host
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("host_id")
    .eq("id", roomId)
    .single();

  if (roomError) {
    console.error("Room fetch error:", roomError);
    throw new Error("Failed to fetch room");
  }

  if (!room) {
    throw new Error("Room not found");
  }

  console.log("Room host_id:", room.host_id, "User id:", user.id, "Match:", room.host_id === user.id);

  if (room.host_id !== user.id) {
    throw new Error("Only the host can start a game");
  }

  // Get a random template from the selected category
  const { data: templates } = await supabase
    .from("story_templates")
    .select("*")
    .eq("category", category)
    .eq("active", true);

  if (!templates || templates.length === 0) {
    throw new Error("No templates found for this category");
  }

  const randomTemplate = templates[Math.floor(Math.random() * templates.length)];

  // Create the game
  const { data: game, error: gameError } = await supabase
    .from("games")
    .insert({
      room_id: roomId,
      template_id: randomTemplate.id,
      status: "waiting",
    })
    .select()
    .single();

  if (gameError || !game) {
    console.error("Game creation error:", gameError);
    throw new Error("Failed to create game");
  }

  // Copy all room participants to game participants and assign word positions
  const { data: roomParticipants } = await supabase
    .from("room_participants")
    .select("user_id")
    .eq("room_id", roomId);

  if (roomParticipants && roomParticipants.length > 0) {
    // Note: Word position assignment is now handled by the database trigger
    // when all participants are ready
    const gameParticipants = roomParticipants.map((p) => {
      return {
        game_id: game.id,
        user_id: p.user_id,
        is_ready: p.user_id === user.id, // Only host is ready initially
        words_assigned: [], // Don't assign words until everyone is ready
      };
    });

    console.log("Inserting game participants:", gameParticipants);

    const { data: insertedParticipants, error: participantsError } = await supabase
      .from("game_participants")
      .insert(gameParticipants)
      .select();

    if (participantsError) {
      console.error("Error adding participants:", participantsError);
      throw new Error(`Failed to add participants to game: ${participantsError.message}`);
    }

    console.log("Inserted participants:", insertedParticipants);

    // Game remains in 'waiting' status until all participants are ready
    // The database trigger will automatically start the game when conditions are met
  }

  revalidatePath(`/game/${game.id}`);
  return { gameId: game.id };
}

export async function markPlayerReady(gameId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const { error } = await supabase
    .from("game_participants")
    .update({ is_ready: true })
    .eq("game_id", gameId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error marking player ready:", error);
    throw new Error("Failed to mark ready");
  }

  revalidatePath(`/game/${gameId}`);
}

export async function cancelGame(gameId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  // Verify user is the host of this game
  const { data: game, error: gameError } = await supabase
    .from("games")
    .select(`
      id,
      status,
      room:rooms(host_id, room_code)
    `)
    .eq("id", gameId)
    .single();

  if (gameError || !game) {
    throw new Error("Game not found");
  }

  const room = Array.isArray(game.room) ? game.room[0] : game.room;
  if (room?.host_id !== user.id) {
    throw new Error("Only the host can cancel the game");
  }

  if (game.status !== "waiting") {
    throw new Error("Can only cancel games that are waiting to start");
  }

  // Delete all game participants (this will trigger cleanup)
  const { error: participantsError } = await supabase
    .from("game_participants")
    .delete()
    .eq("game_id", gameId);

  if (participantsError) {
    console.error("Error removing game participants:", participantsError);
    throw new Error("Failed to remove game participants");
  }

  // Delete the game itself
  const { error: deleteError } = await supabase
    .from("games")
    .delete()
    .eq("id", gameId);

  if (deleteError) {
    console.error("Error deleting game:", deleteError);
    throw new Error("Failed to delete game");
  }

  return { roomCode: room?.room_code };
}

export async function declineGame(gameId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  // Remove player from game participants
  const { error } = await supabase
    .from("game_participants")
    .delete()
    .eq("game_id", gameId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error declining game:", error);
    throw new Error("Failed to decline game");
  }

  revalidatePath(`/game/${gameId}`);
}
