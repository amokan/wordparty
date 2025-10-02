"use server";

import { createClient } from "@/lib/supabase/server";
import { generateRoomCode } from "@/lib/room-utils";
import { redirect } from "next/navigation";

export async function createRoom() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Generate unique room code
  let roomCode = generateRoomCode();
  let attempts = 0;
  const maxAttempts = 10;

  // Check for code collision and regenerate if needed
  while (attempts < maxAttempts) {
    const { data: existingRoom } = await supabase
      .from("rooms")
      .select("id")
      .eq("room_code", roomCode)
      .single();

    if (!existingRoom) {
      break;
    }

    roomCode = generateRoomCode();
    attempts++;
  }

  if (attempts === maxAttempts) {
    throw new Error("Failed to generate unique room code");
  }

  // Create the room
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .insert({
      room_code: roomCode,
      host_id: user.id,
    })
    .select()
    .single();

  if (roomError || !room) {
    console.error("Room creation error:", roomError);
    throw new Error(`Failed to create room: ${roomError?.message || "Unknown error"}`);
  }

  // Add host as participant
  const { error: participantError } = await supabase
    .from("room_participants")
    .insert({
      room_id: room.id,
      user_id: user.id,
    });

  if (participantError) {
    console.error("Participant creation error:", participantError);
    throw new Error(`Failed to add host to room: ${participantError.message}`);
  }

  redirect(`/rooms/${roomCode}`);
}
