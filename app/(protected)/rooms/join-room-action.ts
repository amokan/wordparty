"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isValidRoomCode } from "@/lib/room-utils";

export async function joinRoom(formData: FormData) {
  const roomCode = (formData.get("roomCode") as string)?.toUpperCase().trim();

  console.log("Attempting to join room:", roomCode);

  if (!roomCode) {
    console.error("No room code provided");
    // TODO: Implement proper error state management
    redirect("/rooms?error=no-code");
  }

  if (!isValidRoomCode(roomCode)) {
    console.error("Invalid room code format:", roomCode);
    redirect("/rooms?error=invalid-code");
  }

  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Find the room by code
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, room_code")
    .eq("room_code", roomCode)
    .single();

  if (roomError || !room) {
    console.error("Room not found:", roomError);
    redirect("/rooms?error=room-not-found");
  }

  // Check if user is already a participant
  const { data: existingParticipant } = await supabase
    .from("room_participants")
    .select("id")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .single();

  console.log("Existing participant check:", existingParticipant);

  // If not already a participant, add them
  if (!existingParticipant) {
    const { error: joinError } = await supabase
      .from("room_participants")
      .insert({
        room_id: room.id,
        user_id: user.id,
      });

    if (joinError) {
      console.error("Error joining room:", joinError);
      redirect("/rooms?error=join-failed");
    }

    console.log("Successfully joined room");
  } else {
    console.log("User already in room");
  }

  // Redirect to the room
  redirect(`/rooms/${room.room_code}`);
}