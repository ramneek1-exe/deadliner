import { Check } from "geist-icons";
import type { WizardStep } from "@/lib/types";

interface StepIndicatorProps {
  currentStep: WizardStep;
  compact?: boolean;
}

const STEPS: { key: WizardStep; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "review", label: "Review" },
  { key: "export", label: "Export" },
];

function getStepIndex(step: WizardStep): number {
  return STEPS.findIndex((s) => s.key === step);
}

export function StepIndicator({ currentStep, compact }: StepIndicatorProps) {
  const currentIndex = getStepIndex(currentStep);

  if (compact) {
    return (
      <div className="flex items-center gap-0 pr-5 sm:pr-0">
        {STEPS.map((step, i) => {
          const isActive = i === currentIndex;
          const isCompleted = i < currentIndex;

          return (
            <div key={step.key} className="flex items-center">
              {i > 0 && (
                <div
                  className={`h-px w-8 ${isCompleted ? "bg-foreground" : "bg-border"
                    }`}
                />
              )}
              <div className="flex items-center gap-1.5">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${isActive || isCompleted
                    ? "bg-foreground text-background"
                    : "border border-border text-muted"
                    }`}
                >
                  {isCompleted ? (
                    <Check size={11} />
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={`hidden sm:inline text-xs ${isActive ? "font-medium text-foreground" : "text-muted"
                    }`}
                >
                  {step.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mb-10 flex items-center justify-center gap-0">
      {STEPS.map((step, i) => {
        const isActive = i === currentIndex;
        const isCompleted = i < currentIndex;

        return (
          <div key={step.key} className="flex items-center">
            {i > 0 && (
              <div
                className={`h-px w-10 ${isCompleted ? "bg-foreground" : "bg-border"
                  }`}
              />
            )}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors ${isActive || isCompleted
                  ? "bg-foreground text-background"
                  : "border border-border text-muted"
                  }`}
              >
                {isCompleted ? (
                  <Check size={12} />
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`text-xs ${isActive ? "font-medium text-foreground" : "text-muted"
                  }`}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
