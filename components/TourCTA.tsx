"use client";

import { Compass } from "lucide-react";

interface TourCTAProps {
  onStart: () => void;
  visible: boolean;
}

export function TourCTA({ onStart, visible }: TourCTAProps) {
  return (
    <button
      onClick={onStart}
      className={`fixed bottom-5 right-5 z-[90] flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground shadow-lg transition-all duration-300 ${
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-4 opacity-0"
      } hover:bg-foreground/5`}
    >
      <Compass className="h-4 w-4" />
      Wanna take a tour?
    </button>
  );
}
