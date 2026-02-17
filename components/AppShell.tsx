"use client";

import type { WizardStep } from "@/lib/types";
import { HeroHeader } from "@/components/HeroHeader";
import { StepIndicator } from "@/components/StepIndicator";

interface AppShellProps {
  children: React.ReactNode;
  step: WizardStep;
}

export function AppShell({ children, step }: AppShellProps) {
  const isUpload = step === "upload";

  return (
    <div className="min-h-screen bg-background">
      {isUpload ? (
        <HeroHeader>
          <StepIndicator currentStep={step} compact />
        </HeroHeader>
      ) : (
        <header className="sticky top-0 z-50 border-b border-border px-4 py-3 sm:px-6 sm:py-4"
          style={{
            backgroundColor: `rgba(var(--background-rgb), 0.85)`,
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-extrabold tracking-tighter text-foreground">
              Deadliner
            </h1>
            <StepIndicator currentStep={step} compact />
          </div>
        </header>
      )}
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-10">{children}</main>

      <footer className="border-t border-border px-4 py-6 sm:px-6 sm:py-8 text-center">
        <p className="text-sm text-muted">
          Made with{" "}
          <span
            style={{ fontFamily: "var(--font-geist-pixel-square), monospace" }}
            className="text-foreground"
          >
            ♥
          </span>
          {" "}by{" "}
          <a
            href="https://ramneeksingh.ca"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
          >
            Ramneek
          </a>
        </p>
      </footer>
    </div>
  );
}
