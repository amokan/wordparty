"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { submitWord } from "./actions";

interface Template {
  template: {
    placeholders: Array<{ position: number; type: string }>;
  };
}

interface WordSubmissionPhaseProps {
  gameId: string;
  template: Template;
  wordsAssigned: number[];
}

interface WordOption {
  id: string;
  word: string;
}

export function WordSubmissionPhase({
  gameId,
  template,
  wordsAssigned,
}: WordSubmissionPhaseProps) {
  const router = useRouter();
  const [shuffledPositions, setShuffledPositions] = useState<number[]>([]);
  const [currentPositionIndex, setCurrentPositionIndex] = useState(0);
  const [wordOptions, setWordOptions] = useState<WordOption[]>([]);
  const [customWord, setCustomWord] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submittedPositions, setSubmittedPositions] = useState<number[]>([]);
  const [usedWordIds, setUsedWordIds] = useState<Set<string>>(new Set());

  // Check if custom word input is enabled via environment variable
  const enableCustomWords =
    process.env.NEXT_PUBLIC_ENABLE_CUSTOM_WORDS === "true";

  // Shuffle positions on mount
  useEffect(() => {
    const shuffled = [...wordsAssigned].sort(() => Math.random() - 0.5);
    setShuffledPositions(shuffled);
  }, [wordsAssigned]);

  const currentPosition = shuffledPositions[currentPositionIndex];
  const placeholder = template?.template?.placeholders?.find(
    (p) => p.position === currentPosition
  );
  const wordType = placeholder?.type || "word";

  // Fetch example words for current position
  const fetchExamples = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("word_bank")
      .select("id, word")
      .eq("type", wordType)
      .eq("active", true);

    if (data) {
      // Filter out already used words
      const availableWords = data.filter((w) => !usedWordIds.has(w.id));

      // Shuffle and take 5 random words
      const shuffled = [...availableWords].sort(() => Math.random() - 0.5);
      setWordOptions(shuffled.slice(0, 5));
    }
  }, [wordType, usedWordIds]);

  useEffect(() => {
    if (currentPosition !== undefined) {
      fetchExamples();
    }
  }, [currentPosition, fetchExamples]);

  const handleSubmit = async (word: string, wordBankId?: string) => {
    setIsLoading(true);
    try {
      await submitWord(gameId, currentPosition, word, wordBankId || null);

      // Track used word ID to prevent showing it again
      if (wordBankId) {
        setUsedWordIds(new Set([...usedWordIds, wordBankId]));
      }

      setSubmittedPositions([...submittedPositions, currentPosition]);
      setCustomWord("");

      // Move to next position
      if (currentPositionIndex < shuffledPositions.length - 1) {
        setCurrentPositionIndex(currentPositionIndex + 1);
      }
    } catch (error) {
      console.error("Error submitting word:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customWord.trim()) {
      handleSubmit(customWord.trim());
    }
  };

  const isComplete = submittedPositions.length === shuffledPositions.length;

  // Listen for game status changes and poll for completion
  useEffect(() => {
    const supabase = createClient();

    // Real-time subscription for game status updates
    const channel = supabase
      .channel(`game:${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          console.log("Game status update received:", payload.new.status);
          if (payload.new.status === "finished") {
            console.log("Story finished, refreshing page...");
            router.refresh();
          }
        }
      )
      .subscribe((status) => {
        console.log("Realtime subscription status:", status);
      });

    // Polling fallback - check game status every 2 seconds when all words submitted
    let pollInterval: NodeJS.Timeout | undefined;
    if (isComplete) {
      pollInterval = setInterval(async () => {
        const { data: game } = await supabase
          .from("games")
          .select("status")
          .eq("id", gameId)
          .single();

        if (game?.status === "finished") {
          console.log("Polling detected story finished, refreshing...");
          router.refresh();
          clearInterval(pollInterval!);
        }
      }, 2000);
    }

    return () => {
      supabase.removeChannel(channel);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [gameId, router, isComplete]);

  if (isComplete) {
    return (
      <div className="flex-1 flex flex-col gap-8 w-full max-w-3xl mx-auto items-center justify-center">
        <Card>
          <CardHeader>
            <CardTitle>All Done! ✅</CardTitle>
            <CardDescription>
              You&apos;ve submitted all your words. Waiting for other players...
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => router.refresh()}
              variant="outline"
              className="w-full"
            >
              Check if Story is Ready
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-8 w-full max-w-3xl mx-auto">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Submit Your Words</h1>
        <p className="text-muted-foreground">
          Word {currentPositionIndex + 1} of {shuffledPositions.length}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="capitalize">
            {wordType.replace(/-/g, " ")}
          </CardTitle>
          <CardDescription>
            {enableCustomWords
              ? "Choose one of the suggestions or enter your own"
              : "Choose one of the suggestions"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Example word options */}
          <div className="grid gap-2">
            {wordOptions.map((option) => (
              <Button
                key={option.id}
                variant="outline"
                size="lg"
                onClick={() => handleSubmit(option.word, option.id)}
                disabled={isLoading}
                className="w-full"
              >
                {option.word}
              </Button>
            ))}
          </div>

          {/* Refresh button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchExamples}
            disabled={isLoading}
            className="w-full"
          >
            🔄 Show Different Words
          </Button>

          {/* Custom word input - only show if enabled */}
          {enableCustomWords && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or enter your own
                  </span>
                </div>
              </div>

              <form onSubmit={handleCustomSubmit} className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Type your word..."
                  value={customWord}
                  onChange={(e) => setCustomWord(e.target.value)}
                  disabled={isLoading}
                />
                <Button type="submit" disabled={!customWord.trim() || isLoading}>
                  Submit
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
