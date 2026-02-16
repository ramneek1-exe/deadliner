"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StepIndicator } from "@/components/StepIndicator";
import { UploadStep } from "@/components/UploadStep";
import { ReviewStep } from "@/components/ReviewStep";
import { ExportStep } from "@/components/ExportStep";
import type { WizardStep, DeadlineEvent } from "@/lib/types";

export default function Home() {
  const [step, setStep] = useState<WizardStep>("upload");
  const [events, setEvents] = useState<DeadlineEvent[]>([]);

  const handleEventsExtracted = (extracted: DeadlineEvent[]) => {
    setEvents(extracted);
    setStep("review");
  };

  const handleReset = () => {
    setStep("upload");
    setEvents([]);
  };

  return (
    <AppShell>
      <StepIndicator currentStep={step} />

      {step === "upload" && (
        <UploadStep onEventsExtracted={handleEventsExtracted} />
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
    </AppShell>
  );
}
