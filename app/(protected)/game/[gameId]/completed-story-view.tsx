"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [stylizedStyle, setStylizedStyle] = useState(true);
  const [stylizedUrls, setStylizedUrls] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [generationProgress, setGenerationProgress] = useState<string>("");
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const generationStartTime = useRef<number | null>(null);

  // Check if we've already tried generating images for this game (persistent across refreshes)
  const getStorageKey = (gameId: string) => `image-generation-${gameId}`;
  const getRateLimitKey = (gameId: string) => `rate-limit-${gameId}`;

  // Rate limiting helper functions
  const isRateLimited = useCallback((gameId: string): boolean => {
    const key = getRateLimitKey(gameId);
    const lastAttempt = localStorage.getItem(key);
    if (!lastAttempt) return false;

    const timeSinceLastAttempt = Date.now() - parseInt(lastAttempt);
    const rateLimitMs = 30000; // 30 seconds between manual retries
    return timeSinceLastAttempt < rateLimitMs;
  }, []);

  const setRateLimit = useCallback((gameId: string): void => {
    const key = getRateLimitKey(gameId);
    localStorage.setItem(key, Date.now().toString());
  }, []);

  const getRemainingCooldown = useCallback((gameId: string): number => {
    const key = getRateLimitKey(gameId);
    const lastAttempt = localStorage.getItem(key);
    if (!lastAttempt) return 0;

    const timeSinceLastAttempt = Date.now() - parseInt(lastAttempt);
    const rateLimitMs = 30000;
    return Math.max(0, Math.ceil((rateLimitMs - timeSinceLastAttempt) / 1000));
  }, []);

  // Helper function to create timeout promise
  const createTimeoutPromise = (ms: number) => {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), ms);
    });
  };

  // Helper function for exponential backoff delay
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const callImageGenerationEdgeFunction = useCallback(async (
    gameId: string,
    storyText: string,
    attempt: number = 1
  ): Promise<void> => {
    const maxAttempts = 3;
    const timeoutMs = 45000; // 45 second timeout

    try {
      setErrorMessage(null);
      setRetryAttempt(attempt);

      const supabase = createClient();

      // Get the session token
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Authentication required. Please refresh the page.");
      }

      const supabaseUrl =
        process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/generate-story-images`;

      // Create abort controller for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Race between fetch and timeout
      const fetchPromise = fetch(edgeFunctionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          gameId,
          storyText,
        }),
        signal: abortController.signal,
      });

      const response = await Promise.race([
        fetchPromise,
        createTimeoutPromise(timeoutMs)
      ]) as Response;

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      console.log("Edge Function success:", result);

      // Clear the abort controller reference
      abortControllerRef.current = null;

    } catch (error) {
      console.error(`Edge Function error (attempt ${attempt}):`, error);

      // Clear the abort controller reference
      abortControllerRef.current = null;

      // If this wasn't the last attempt, retry with exponential backoff
      if (attempt < maxAttempts) {
        const backoffDelay = Math.pow(2, attempt - 1) * 2000; // 2s, 4s, 8s
        console.log(`Retrying in ${backoffDelay}ms... (attempt ${attempt + 1}/${maxAttempts})`);

        await delay(backoffDelay);
        return callImageGenerationEdgeFunction(gameId, storyText, attempt + 1);
      }

      // All attempts failed
      setIsGeneratingImages(false);

      let userMessage = "Failed to generate image after multiple attempts.";
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          userMessage = "Image generation timed out. This can happen with complex stories.";
        } else if (error.message.includes('Authentication')) {
          userMessage = error.message;
        } else if (error.message.includes('Server error')) {
          userMessage = "Server temporarily unavailable. Please try again.";
        }
      }

      setErrorMessage(userMessage);
    }
  }, [setErrorMessage, setIsGeneratingImages, setRetryAttempt]);

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

        // Check if we've already attempted generation (persistent check)
        const storageKey = getStorageKey(gameId);
        const hasAttempted = localStorage.getItem(storageKey);

        // If images not generated yet and we haven't attempted, trigger Edge Function
        if (!data.images_generated && !hasAttempted && !hasCalledEdgeFunction) {
          setHasCalledEdgeFunction(true);
          setIsGeneratingImages(true);
          generationStartTime.current = Date.now();
          setGenerationProgress("Generating AI illustration...");
          localStorage.setItem(storageKey, 'true');
          await callImageGenerationEdgeFunction(gameId, data.story_text);
        }
      }
    };

    fetchStory();
  }, [gameId, hasCalledEdgeFunction, callImageGenerationEdgeFunction]);

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
            setErrorMessage(null);
            setGenerationProgress("");
            setEstimatedTimeRemaining(null);
            generationStartTime.current = null;

            // Clear the generation attempt flag since it succeeded
            const storageKey = getStorageKey(gameId);
            localStorage.removeItem(storageKey);
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
          setErrorMessage(null);
          clearInterval(pollInterval!);

          // Clear the generation attempt flag since it succeeded
          const storageKey = getStorageKey(gameId);
          localStorage.removeItem(storageKey);
        }
      }, 3000);
    }

    return () => {
      supabase.removeChannel(channel);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [gameId, isGeneratingImages]);

  // Progress tracking effect
  useEffect(() => {
    if (!isGeneratingImages) return;

    const progressMessages = [
      "Analyzing your story...",
      "Generating AI illustration...",
      "Adding creative details...",
      "Finalizing artwork...",
      "Almost ready..."
    ];

    let messageIndex = 0;
    const progressInterval: NodeJS.Timeout = setInterval(() => {
      if (messageIndex < progressMessages.length) {
        setGenerationProgress(progressMessages[messageIndex]);
        messageIndex++;

        // Update estimated time remaining
        if (generationStartTime.current) {
          const elapsed = Date.now() - generationStartTime.current;
          const avgTimePerStep = elapsed / messageIndex;
          const remainingSteps = progressMessages.length - messageIndex;
          const estimated = Math.max(0, Math.round((remainingSteps * avgTimePerStep) / 1000));
          setEstimatedTimeRemaining(estimated);
        }
      }
    }, 8000);

    return () => {
      if (progressInterval) clearInterval(progressInterval);
    };
  }, [isGeneratingImages]);

  // Generate stylized composite images
  useEffect(() => {
    if (!stylizedStyle || !story?.image_urls) {
      setStylizedUrls([]);
      return;
    }

    const generateStylizedImages = async () => {
      const urls: string[] = [];

      for (let i = 0; i < story.image_urls!.length; i++) {
        const imageUrl = story.image_urls![i];
        const canvas = canvasRefs.current[i];

        if (!canvas) continue;

        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        // Load the image
        const img = new window.Image();
        img.crossOrigin = 'anonymous';

        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            // Stylized image dimensions
            const padding = 40;
            const textHeight = 140;
            const imageWidth = img.width;
            const imageHeight = img.height;
            const canvasWidth = imageWidth + (padding * 2);
            const canvasHeight = imageHeight + (padding * 2) + textHeight;

            // Set canvas size
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;

            // Draw white background (stylized frame)
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            // Draw the AI image
            ctx.drawImage(img, padding, padding, imageWidth, imageHeight);

            // Add story text in bottom white space
            ctx.fillStyle = '#1a1a1a';
            ctx.font = '18px "Comic Sans MS", cursive, sans-serif';
            ctx.textAlign = 'center';

            // Word wrap the text
            const maxWidth = canvasWidth - (padding * 2);
            const lines = wrapText(ctx, story.story_text, maxWidth);
            const lineHeight = 24;
            const textY = imageHeight + (padding * 2) + 30;

            // Only show first few lines to fit in stylized bottom
            const maxLines = 4;
            const visibleLines = lines.slice(0, maxLines);

            visibleLines.forEach((line, idx) => {
              ctx.fillText(line, canvasWidth / 2, textY + (idx * lineHeight));
            });

            // Add "..." if text is truncated
            if (lines.length > maxLines) {
              ctx.fillText('...', canvasWidth / 2, textY + (maxLines * lineHeight));
            }

            resolve();
          };

          img.onerror = reject;
          img.src = imageUrl;
        });

        // Convert canvas to data URL
        const dataUrl = canvas.toDataURL('image/png');
        urls.push(dataUrl);
      }

      setStylizedUrls(urls);
    };

    generateStylizedImages();
  }, [stylizedStyle, story?.image_urls, story?.story_text]);

  // Helper function to wrap text
  const wrapText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
  ): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) lines.push(currentLine);
    return lines;
  };

  // Manual retry function for user-triggered retries
  const handleManualRetry = async () => {
    if (!story || isGeneratingImages) return;

    // Check rate limiting
    if (isRateLimited(gameId)) {
      const remaining = getRemainingCooldown(gameId);
      setErrorMessage(`Please wait a moment before trying again. Ready in ${remaining} seconds.`);
      return;
    }

    // Set rate limit for this attempt
    setRateLimit(gameId);

    // Clear the storage flag to allow retry
    const storageKey = getStorageKey(gameId);
    localStorage.removeItem(storageKey);

    setIsGeneratingImages(true);
    setErrorMessage(null);
    setRetryAttempt(0);
    setHasCalledEdgeFunction(false);
    generationStartTime.current = Date.now();
    setGenerationProgress("Retrying image generation...");

    // Set the flag again to prevent other instances from calling
    localStorage.setItem(storageKey, 'true');
    await callImageGenerationEdgeFunction(gameId, story.story_text);
  };

  // Cooldown timer effect
  useEffect(() => {
    if (errorMessage && errorMessage.includes('wait')) {
      const cooldownInterval = setInterval(() => {
        const remaining = getRemainingCooldown(gameId);
        setCooldownSeconds(remaining);

        if (remaining <= 0) {
          setCooldownSeconds(0);
          clearInterval(cooldownInterval);
        }
      }, 1000);

      return () => clearInterval(cooldownInterval);
    }
  }, [gameId, errorMessage, getRemainingCooldown]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

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
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                <p className="text-muted-foreground">
                  ✨ {generationProgress || "Generating AI illustration for your story..."}
                </p>
              </div>

              {retryAttempt > 1 && (
                <p className="text-sm text-muted-foreground">
                  Attempt {retryAttempt} of 3
                </p>
              )}

              {estimatedTimeRemaining !== null && estimatedTimeRemaining > 0 && (
                <p className="text-xs text-muted-foreground">
                  Estimated time remaining: {estimatedTimeRemaining}s
                </p>
              )}

              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: generationStartTime.current
                      ? `${Math.min(95, (Date.now() - generationStartTime.current) / 450)}%`
                      : '10%'
                  }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error display section */}
      {errorMessage && !isGeneratingImages && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <p className="text-destructive">
                ⚠️ {errorMessage}
              </p>
              <Button
                variant="outline"
                onClick={handleManualRetry}
                disabled={cooldownSeconds > 0}
                className="mx-auto"
              >
                {cooldownSeconds > 0 ? (
                  <>⏳ Wait {cooldownSeconds}s</>
                ) : (
                  <>🔄 Try Again</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {story.images_generated && story.image_urls && story.image_urls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>✨ AI Generated Illustration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Stylized image toggle */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="stylized-style"
                checked={stylizedStyle}
                onCheckedChange={(checked) => setStylizedStyle(checked as boolean)}
              />
              <label
                htmlFor="stylized-style"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Stylized Frame (add story text below image)
              </label>
            </div>

            {/* Hidden canvases for compositing */}
            {story.image_urls.map((_, index) => (
              <canvas
                key={`canvas-${index}`}
                ref={(el) => { canvasRefs.current[index] = el; }}
                style={{ display: 'none' }}
              />
            ))}

            {/* Display images */}
            {story.image_urls.map((url, index) => (
              <div key={index} className="w-full rounded-lg overflow-hidden bg-muted">
                {stylizedStyle && stylizedUrls[index] ? (
                  // Show stylized composite
                  <div className="bg-white p-2 inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={stylizedUrls[index]}
                      alt={`Story illustration ${index + 1} - Stylized frame style`}
                      className="w-full h-auto"
                    />
                  </div>
                ) : (
                  // Show original image
                  <Image
                    src={url}
                    alt={`Story illustration ${index + 1}`}
                    width={1344}
                    height={768}
                    className="w-full h-auto"
                    sizes="(max-width: 768px) 100vw, 768px"
                  />
                )}
              </div>
            ))}

            {/* Download button for stylized version */}
            {stylizedStyle && stylizedUrls.length > 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  stylizedUrls.forEach((dataUrl, index) => {
                    const link = document.createElement('a');
                    link.href = dataUrl;
                    link.download = `story-stylized-${gameId}-${index}.png`;
                    link.click();
                  });
                }}
                className="w-full"
              >
                📸 Download Stylized Image{stylizedUrls.length > 1 ? 's' : ''}
              </Button>
            )}
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
