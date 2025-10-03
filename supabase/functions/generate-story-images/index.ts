import { GoogleGenAI } from "npm:@google/genai@1.22.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  gameId: string;
  storyText: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("Edge Function called, method:", req.method);

    // Parse request body
    const { gameId, storyText }: RequestBody = await req.json();
    console.log("Request body parsed, gameId:", gameId);

    if (!gameId || !storyText) {
      return new Response(
        JSON.stringify({ error: "Missing gameId or storyText" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Google GenAI
    const googleApiKey = Deno.env.get("GOOGLE_GENAI_API_KEY");
    if (!googleApiKey) {
      console.error("GOOGLE_GENAI_API_KEY not found in environment");
      throw new Error("GOOGLE_GENAI_API_KEY not configured");
    }

    const ai = new GoogleGenAI({ apiKey: googleApiKey });

    // Generate image based on story
    const prompt = `Create a whimsical, fun illustration for this Mad Libs-style story. The image should be colorful, family-friendly, and capture the humor of the story:\n\n${storyText}`;

    console.log("Generating image for game:", gameId);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: prompt,
      generationConfig: {
        aspectRatio: "16:9",
      },
    });

    // Extract image data from response
    const imageParts = [];
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        imageParts.push(part);
      }
    }

    console.log("Image parts found:", imageParts.length);

    if (imageParts.length === 0) {
      throw new Error("No images generated");
    }

    // Initialize Supabase client with service role key for admin access
    // Use internal SUPABASE_URL for storage operations (works within Docker network)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const imageUrls: string[] = [];

    // Upload each generated image to Supabase Storage
    for (let i = 0; i < imageParts.length; i++) {
      const imageData = imageParts[i].inlineData.data;
      const buffer = Uint8Array.from(atob(imageData), (c) => c.charCodeAt(0));

      // Upload to storage bucket
      const fileName = `${gameId}-${i}.png`;
      const { error: uploadError } = await supabase.storage
        .from("story-images")
        .upload(fileName, buffer, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw uploadError;
      }

      // Generate public URL
      // For local dev, use PUBLIC_STORAGE_URL (external localhost)
      // For production, use SUPABASE_URL (already correct external URL)
      const publicStorageUrl = Deno.env.get("PUBLIC_STORAGE_URL") || Deno.env.get("SUPABASE_URL");
      const publicUrl = `${publicStorageUrl}/storage/v1/object/public/story-images/${fileName}`;

      console.log("Generated public URL:", publicUrl);
      imageUrls.push(publicUrl);
    }

    // Update completed_stories record
    const { error: updateError } = await supabase
      .from("completed_stories")
      .update({
        image_urls: imageUrls,
        images_generated: true,
      })
      .eq("game_id", gameId);

    if (updateError) {
      console.error("Update error:", updateError);
      throw updateError;
    }

    console.log("Successfully generated and stored images for game:", gameId);

    return new Response(
      JSON.stringify({
        success: true,
        imageUrls,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
