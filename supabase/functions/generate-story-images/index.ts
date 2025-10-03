import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

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

    // Check if images have already been generated for this game
    const { data: existingStory, error: fetchError } = await supabase
      .from("completed_stories")
      .select("images_generated, image_urls")
      .eq("game_id", gameId)
      .single();

    if (fetchError) {
      console.error("Error fetching completed story:", fetchError);
      throw new Error("Failed to check existing story");
    }

    if (existingStory?.images_generated) {
      console.log("Images already generated for game:", gameId);
      return new Response(
        JSON.stringify({
          success: true,
          imageUrl: existingStory.image_urls?.[0] || null,
          message: "Images already generated",
        }),
        {
          status: 200,
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
    const prompt = `Create a whimsical, fun illustration for this humorous story. The image should be colorful, family-friendly, and capture the playful spirit of the narrative:\n\n${storyText}`;

    console.log("Generating image for game:", gameId);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: prompt,
      generationConfig: {
        aspectRatio: "16:9",
      },
    });

    // Extract image data from response (expecting single image)
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

    // Upload the single generated image to Supabase Storage
    const imageData = imageParts[0].inlineData.data;
    const buffer = Uint8Array.from(atob(imageData), (c) => c.charCodeAt(0));

    // Check if file already exists in storage as additional safeguard
    const fileName = `${gameId}.png`;
    const { data: existingFile } = await supabase.storage
      .from("story-images")
      .list("", { search: fileName });

    if (existingFile && existingFile.length > 0) {
      console.log("Image file already exists in storage for game:", gameId);

      // Generate public URL for existing file
      const publicStorageUrl = Deno.env.get("PUBLIC_STORAGE_URL") || Deno.env.get("SUPABASE_URL");
      const publicUrl = `${publicStorageUrl}/storage/v1/object/public/story-images/${fileName}`;

      return new Response(
        JSON.stringify({
          success: true,
          imageUrl: publicUrl,
          message: "Image already exists in storage",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Upload to storage bucket
    const { error: uploadError } = await supabase.storage
      .from("story-images")
      .upload(fileName, buffer, {
        contentType: "image/png",
        upsert: true, // Keep true to handle race conditions safely
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
    const imageUrls = [publicUrl];

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

    console.log("Successfully generated and stored image for game:", gameId);

    return new Response(
      JSON.stringify({
        success: true,
        imageUrl: imageUrls[0],
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
