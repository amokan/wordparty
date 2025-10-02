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
import { useState } from "react";
import { startGame } from "./actions";

interface StartGameFormProps {
  roomId: string;
  categories: string[];
}

export function StartGameForm({ roomId, categories }: StartGameFormProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory) return;

    setIsLoading(true);
    try {
      await startGame(roomId, selectedCategory);
    } catch (error) {
      console.error("Error starting game:", error);
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Start a Game</CardTitle>
        <CardDescription>
          As the host, you can start a new game when ready
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
                <SelectValue placeholder="Choose a category..." />
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
            {isLoading ? "Starting Game..." : "Start Game"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
