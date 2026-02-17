"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { UploadStep } from "@/components/UploadStep";
import { Faq } from "@/components/Faq";
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
    </AppShell>
  );
}
