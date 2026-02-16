"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, AlertCircle, Loader2 } from "lucide-react";
import type { DeadlineEvent } from "@/lib/types";

interface UploadStepProps {
  onEventsExtracted: (events: DeadlineEvent[]) => void;
}

const STATUS_MESSAGES = [
  "Reading your syllabus...",
  "Extracting deadlines...",
  "Parsing dates and times...",
  "Almost there...",
];

export function UploadStep({ onEventsExtracted }: UploadStepProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusIndex, setStatusIndex] = useState(0);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setLoading(true);
      setError(null);
      setStatusIndex(0);

      const interval = setInterval(() => {
        setStatusIndex((prev) =>
          prev < STATUS_MESSAGES.length - 1 ? prev + 1 : prev
        );
      }, 2500);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/parse", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Something went wrong. Please try again.");
          return;
        }

        if (data.events.length === 0) {
          setError("No deadlines found in this syllabus. Try a different file.");
          return;
        }

        onEventsExtracted(data.events);
      } catch {
        setError("Network error. Please check your connection and try again.");
      } finally {
        clearInterval(interval);
        setLoading(false);
      }
    },
    [onEventsExtracted]
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone({
      onDrop,
      accept: { "application/pdf": [".pdf"] },
      maxSize: 5 * 1024 * 1024,
      multiple: false,
      disabled: loading,
    });

  const rejectionError = fileRejections.length > 0
    ? fileRejections[0].errors[0].code === "file-too-large"
      ? "File too large. Maximum size is 5MB."
      : "Only PDF files are accepted."
    : null;

  const displayError = error || rejectionError;

  return (
    <div className="animate-fade-in-up">
      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-16 transition-colors ${
          loading
            ? "pointer-events-none border-border"
            : isDragActive
              ? "border-foreground bg-foreground/5"
              : "border-border hover:border-foreground/50"
        }`}
      >
        <input {...getInputProps()} />

        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-muted" />
            <p className="text-sm font-medium text-foreground">
              {STATUS_MESSAGES[statusIndex]}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <Upload
              className={`h-10 w-10 ${
                isDragActive ? "text-foreground" : "text-muted"
              }`}
            />
            <div className="text-center">
              <p className="text-lg font-medium text-foreground">
                {isDragActive
                  ? "Drop your syllabus here"
                  : "Drop your syllabus here"}
              </p>
              <p className="mt-1 text-sm text-muted">
                or click to browse. PDF only, up to 5MB.
              </p>
            </div>
          </div>
        )}
      </div>

      {displayError && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-danger/30 bg-danger/5 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <div className="flex flex-1 items-center justify-between">
            <p className="text-sm text-danger">{displayError}</p>
            <button
              onClick={() => {
                setError(null);
              }}
              className="ml-4 text-xs font-medium text-danger underline underline-offset-2 hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
