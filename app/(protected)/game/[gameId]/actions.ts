"use server";

import { createClient } from "@/lib/supabase/server";

export async function submitWord(
  gameId: string,
  position: number,
  word: string,
  wordBankId: string | null
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  // Insert the word submission
  const { error } = await supabase.from("word_submissions").insert({
    game_id: gameId,
    user_id: user.id,
    position,
    word,
    word_bank_id: wordBankId,
    auto_submitted: false,
  });

  if (error) {
    console.error("Word submission error:", error);
    throw new Error("Failed to submit word");
  }

  return { success: true };
}
