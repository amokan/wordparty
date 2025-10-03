"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { startGame } from "./actions";

interface StartGameFormProps {
  roomId: string;
  categories: string[];
}

export function StartGameForm({ roomId, categories }: StartGameFormProps) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // Set a random category on mount
  useEffect(() => {
    if (categories.length > 0 && !selectedCategory) {
      const randomIndex = Math.floor(Math.random() * categories.length);
      setSelectedCategory(categories[randomIndex]);
    }
  }, [categories, selectedCategory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory) return;

    setIsLoading(true);
    try {
      const result = await startGame(roomId, selectedCategory);
      // Navigate after the server action completes successfully
      router.push(`/game/${result.gameId}`);
    } catch (error) {
      console.error("Error starting game:", error);
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Start a Story</CardTitle>
        <CardDescription>
          As the host, you can start a new story when ready
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="category" className="text-sm font-medium">
              Select Story Category
            </label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Loading categories..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={!selectedCategory || isLoading}
          >
            {isLoading ? "Starting Story..." : "Start Story"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
