"use client";

import { Compass } from "lucide-react";

interface TourCTAProps {
  onStart: () => void;
}

export function TourCTA({ onStart }: TourCTAProps) {
  return (
    <button
      onClick={onStart}
      className="fixed bottom-5 right-5 z-[90] flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground shadow-lg hover:bg-foreground/5 transition-colors"
    >
      <Compass className="h-4 w-4" />
      Wanna take a tour?
    </button>
  );
}
