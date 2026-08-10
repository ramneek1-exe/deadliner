"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { WizardStep } from "@/lib/types";
import { TOUR_STEPS } from "@/lib/tour-steps";

interface TourProps {
  step: WizardStep;
  active: boolean;
  index: number;
  onNext: () => void;
  onDismiss: () => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function findTourTarget(id: string): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`);
  for (const el of Array.from(candidates)) {
    if (el.offsetParent !== null) return el;
  }
  return null;
}

const SPOTLIGHT_PADDING = 8;
const TOOLTIP_WIDTH = 288;
const TOOLTIP_HEIGHT_ESTIMATE = 150;
const TOOLTIP_GAP = 12;
const VIEWPORT_MARGIN = 12;

export function Tour({ step, active, index, onNext, onDismiss }: TourProps) {
  const [rect, setRect] = useState<Rect | null>(null);
  const current = active ? TOUR_STEPS[index] : undefined;
  const isCurrentStopVisible = !!current && current.wizardStep === step;

  useEffect(() => {
    if (!isCurrentStopVisible || !current) {
      setRect(null);
      return;
    }

    function measure() {
      const el = findTourTarget(current!.id);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }

    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    // The target may not exist yet the instant this effect runs (e.g. async
    // parse results still loading) — poll lightly until it appears.
    const interval = setInterval(measure, 300);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      clearInterval(interval);
    };
  }, [isCurrentStopVisible, current]);

  useEffect(() => {
    if (!active) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onDismiss();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [active, onDismiss]);

  if (!isCurrentStopVisible || !rect || !current) return null;

  const spotTop = rect.top - SPOTLIGHT_PADDING;
  const spotLeft = rect.left - SPOTLIGHT_PADDING;
  const spotWidth = rect.width + SPOTLIGHT_PADDING * 2;
  const spotHeight = rect.height + SPOTLIGHT_PADDING * 2;
  const spotBottom = spotTop + spotHeight;
  const spotRight = spotLeft + spotWidth;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const spaceBelow = vh - spotBottom;
  const placeBelow = spaceBelow > TOOLTIP_HEIGHT_ESTIMATE + TOOLTIP_GAP;
  const tooltipTop = placeBelow
    ? spotBottom + TOOLTIP_GAP
    : Math.max(VIEWPORT_MARGIN, spotTop - TOOLTIP_HEIGHT_ESTIMATE - TOOLTIP_GAP);
  const tooltipLeft = Math.min(
    Math.max(VIEWPORT_MARGIN, spotLeft),
    vw - TOOLTIP_WIDTH - VIEWPORT_MARGIN
  );

  const stopsInStep = TOUR_STEPS.filter((s) => s.wizardStep === step);
  const positionInStep = stopsInStep.findIndex((s) => s.id === current.id) + 1;
  const isLastOverall = index === TOUR_STEPS.length - 1;

  return (
    <>
      {/* Visual dark backdrop with a spotlight cutout — purely visual,
          pointer-events:none so it never blocks clicks itself. */}
      <div
        className="fixed z-[100] rounded-md transition-all duration-200"
        style={{
          top: spotTop,
          left: spotLeft,
          width: spotWidth,
          height: spotHeight,
          boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.6)",
          pointerEvents: "none",
        }}
      />

      {/* Click-blocking strips surrounding the spotlight rect. The
          spotlight rect itself has no blocker over it, so a real click on
          the highlighted element reaches it normally. */}
      <div
        className="fixed z-[100]"
        style={{ top: 0, left: 0, width: vw, height: Math.max(0, spotTop) }}
      />
      <div
        className="fixed z-[100]"
        style={{
          top: spotBottom,
          left: 0,
          width: vw,
          height: Math.max(0, vh - spotBottom),
        }}
      />
      <div
        className="fixed z-[100]"
        style={{ top: spotTop, left: 0, width: Math.max(0, spotLeft), height: spotHeight }}
      />
      <div
        className="fixed z-[100]"
        style={{
          top: spotTop,
          left: spotRight,
          width: Math.max(0, vw - spotRight),
          height: spotHeight,
        }}
      />

      {/* Tooltip */}
      <div
        className="fixed z-[101] rounded-lg border border-border bg-background p-4 shadow-lg"
        style={{ top: tooltipTop, left: tooltipLeft, width: TOOLTIP_WIDTH }}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-muted">
            Step {positionInStep} of {stopsInStep.length}
          </p>
          <button
            onClick={onDismiss}
            className="rounded p-0.5 text-muted hover:text-foreground transition-colors"
            aria-label="Close tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <h3 className="mt-1.5 text-sm font-semibold text-foreground">{current.title}</h3>
        <p className="mt-1 text-sm text-muted">{current.body}</p>
        <button
          onClick={onNext}
          className="mt-3 w-full rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 transition-opacity"
        >
          {isLastOverall ? "Done" : "Next"}
        </button>
      </div>
    </>
  );
}
