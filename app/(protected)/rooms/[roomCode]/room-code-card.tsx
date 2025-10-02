"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";

interface RoomCodeCardProps {
  roomCode: string;
}

export function RoomCodeCard({ roomCode }: RoomCodeCardProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Room Code</CardTitle>
        <CardDescription>Share this code with friends</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-3xl font-mono font-bold tracking-wider">
          {roomCode}
        </div>
        <Button onClick={copyToClipboard} variant="outline" className="w-full">
          {copied ? "Copied!" : "Copy Code"}
        </Button>
      </CardContent>
    </Card>
  );
}
