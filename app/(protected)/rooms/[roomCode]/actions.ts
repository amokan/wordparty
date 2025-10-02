"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

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
    .select("id")
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

  // Copy all room participants to game participants
  const { data: roomParticipants } = await supabase
    .from("room_participants")
    .select("user_id")
    .eq("room_id", roomId);

  if (roomParticipants && roomParticipants.length > 0) {
    const gameParticipants = roomParticipants.map((p) => ({
      game_id: game.id,
      user_id: p.user_id,
      is_ready: false,
    }));

    const { error: participantsError } = await supabase
      .from("game_participants")
      .insert(gameParticipants);

    if (participantsError) {
      console.error("Error adding participants:", participantsError);
      throw new Error("Failed to add participants to game");
    }
  }

  redirect(`/game/${game.id}`);
}
