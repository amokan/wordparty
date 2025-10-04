"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function joinRoom(formData: FormData) {
  const roomCode = formData.get("roomCode") as string;

  if (!roomCode) {
    // TODO: Add proper error handling
    return;
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
    .eq("room_code", roomCode.toUpperCase())
    .single();

  if (roomError || !room) {
    // TODO: Add proper error handling for room not found
    console.error("Room not found:", roomError);
    return;
  }

  // Check if user is already a participant
  const { data: existingParticipant } = await supabase
    .from("room_participants")
    .select("id")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .single();

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
      return;
    }
  }

  // Redirect to the room
  redirect(`/rooms/${room.room_code}`);
}