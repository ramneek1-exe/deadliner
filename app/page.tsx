"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { UploadStep } from "@/components/UploadStep";
import { Faq } from "@/components/Faq";
import { ReviewStep } from "@/components/ReviewStep";
import { ExportStep } from "@/components/ExportStep";
import { Tour } from "@/components/Tour";
import { TourCTA } from "@/components/TourCTA";
import { TOUR_STEPS } from "@/lib/tour-steps";
import type { WizardStep, DeadlineEvent } from "@/lib/types";

function firstTourIndexForStep(step: WizardStep): number {
  const idx = TOUR_STEPS.findIndex((s) => s.wizardStep === step);
  return idx === -1 ? 0 : idx;
}

export default function Home() {
  const [step, setStep] = useState<WizardStep>("upload");
  const [events, setEvents] = useState<DeadlineEvent[]>([]);
  const [tourActive, setTourActive] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);

  const handleEventsExtracted = (extracted: DeadlineEvent[]) => {
    setEvents(extracted);
    setStep("review");
  };

  const handleReset = () => {
    setStep("upload");
    setEvents([]);
  };

  const handleTourStart = () => {
    setTourIndex(firstTourIndexForStep(step));
    setTourActive(true);
  };

  const handleTourNext = () => {
    const next = tourIndex + 1;
    if (next >= TOUR_STEPS.length) {
      setTourActive(false);
      return;
    }
    setTourIndex(next);
  };

  const handleTourDismiss = () => {
    setTourActive(false);
  };

  // Continuity: when the wizard step changes while the tour is running,
  // jump to that step's first stop so the tour follows the user forward.
  // Intentionally excludes tourActive from deps — handleTourStart already
  // sets the correct index when the tour starts; this effect only needs to
  // react to step changes.
  useEffect(() => {
    if (!tourActive) return;
    setTourIndex(firstTourIndexForStep(step));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return (
    <AppShell step={step}>
      {step === "upload" && (
        <>
          <UploadStep onEventsExtracted={handleEventsExtracted} />
          <Faq />
        </>
      )}

      {step === "review" && (
        <ReviewStep
          events={events}
          onEventsChange={setEvents}
          onExport={() => setStep("export")}
          onReset={handleReset}
        />
      )}

      {step === "export" && (
        <ExportStep events={events} onReset={handleReset} />
      )}

      {!tourActive && <TourCTA onStart={handleTourStart} />}
      <Tour
        step={step}
        active={tourActive}
        index={tourIndex}
        onNext={handleTourNext}
        onDismiss={handleTourDismiss}
      />
    </AppShell>
  );
}
