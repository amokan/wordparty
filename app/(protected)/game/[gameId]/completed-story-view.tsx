"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface CompletedStoryViewProps {
  gameId: string;
  roomCode: string;
  isHost: boolean;
}

interface CompletedStory {
  story_text: string;
  image_urls: string[] | null;
  images_generated: boolean;
  game?: {
    template: {
      title: string;
    };
  };
}

export function CompletedStoryView({
  gameId,
  roomCode,
  isHost,
}: CompletedStoryViewProps) {
  const router = useRouter();
  const [story, setStory] = useState<CompletedStory | null>(null);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [hasCalledEdgeFunction, setHasCalledEdgeFunction] = useState(false);

  // Fetch completed story
  useEffect(() => {
    const fetchStory = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("completed_stories")
        .select(`
          *,
          game:games(
            template:story_templates(title)
          )
        `)
        .eq("game_id", gameId)
        .single();

      if (data) {
        setStory(data);

        // If images not generated yet, trigger Edge Function
        if (!data.images_generated && !hasCalledEdgeFunction) {
          setHasCalledEdgeFunction(true);
          setIsGeneratingImages(true);
          await callImageGenerationEdgeFunction(gameId, data.story_text);
        }
      }
    };

    fetchStory();
  }, [gameId, hasCalledEdgeFunction]);

  // Listen for image generation completion
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`completed_story:${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "completed_stories",
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          console.log("Story update received:", payload.new);
          if (payload.new.images_generated) {
            console.log("Images generated, updating story state");
            setStory(payload.new as CompletedStory);
            setIsGeneratingImages(false);
          }
        }
      )
      .subscribe((status) => {
        console.log("Story realtime subscription status:", status);
      });

    // Polling fallback - check for images every 3 seconds while generating
    let pollInterval: NodeJS.Timeout | undefined;
    if (isGeneratingImages) {
      pollInterval = setInterval(async () => {
        console.log("Polling for image completion...");
        const { data } = await supabase
          .from("completed_stories")
          .select(`
            *,
            game:games(
              template:story_templates(title)
            )
          `)
          .eq("game_id", gameId)
          .single();

        if (data?.images_generated) {
          console.log("Polling detected images ready, updating state");
          setStory(data);
          setIsGeneratingImages(false);
          clearInterval(pollInterval!);
        }
      }, 3000);
    }

    return () => {
      supabase.removeChannel(channel);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [gameId, isGeneratingImages]);

  const callImageGenerationEdgeFunction = async (
    gameId: string,
    storyText: string
  ) => {
    try {
      const supabase = createClient();

      // Get the session token
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        console.error("No session found");
        setIsGeneratingImages(false);
        return;
      }

      const supabaseUrl =
        process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/generate-story-images`;

      const response = await fetch(edgeFunctionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          gameId,
          storyText,
        }),
      });

      if (!response.ok) {
        console.error("Edge Function error:", await response.text());
        setIsGeneratingImages(false);
      }
    } catch (error) {
      console.error("Error calling Edge Function:", error);
      setIsGeneratingImages(false);
    }
  };

  if (!story) {
    return (
      <div className="flex-1 flex flex-col gap-8 w-full max-w-3xl mx-auto items-center justify-center">
        <Card>
          <CardHeader>
            <CardTitle>Loading Story...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-8 w-full max-w-3xl mx-auto pb-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold">🎉 Story Complete!</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{story.game?.template?.title || "Your Story"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-lg dark:prose-invert max-w-none">
            <p className="text-xl leading-relaxed whitespace-pre-wrap font-serif italic">
              {story.story_text}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Image display section */}
      {isGeneratingImages && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-muted-foreground">
                ✨ Generating AI illustration for your story...
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {story.images_generated && story.image_urls && story.image_urls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>✨ AI Generated Illustration</CardTitle>
          </CardHeader>
          <CardContent>
            {story.image_urls.map((url, index) => (
              <div key={index} className="w-full rounded-lg overflow-hidden bg-muted">
                <Image
                  src={url}
                  alt={`Story illustration ${index + 1}`}
                  width={1344}
                  height={768}
                  className="w-full h-auto"
                  sizes="(max-width: 768px) 100vw, 768px"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Action buttons */}
      <div className="flex gap-4">
        <Button
          variant="outline"
          onClick={() => router.push(`/rooms/${roomCode}`)}
          className="flex-1"
        >
          Back to Room
        </Button>
        {isHost && (
          <Button
            onClick={() => router.push(`/rooms/${roomCode}`)}
            className="flex-1"
          >
            Start New Story
          </Button>
        )}
      </div>
    </div>
  );
}
