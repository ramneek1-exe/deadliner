"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { CheckCircleFill, Copy } from "geist-icons";
import { generateICS } from "@/lib/generate-ics";
import type { DeadlineEvent } from "@/lib/types";

interface ExportStepProps {
  events: DeadlineEvent[];
  onReset: () => void;
}

type Platform = "ios" | "android" | "desktop";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

function AppleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 814 1000" fill="currentColor">
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57.8-155.5-127.4c-58.3-81.6-105.7-208.4-105.7-328.3 0-193 125.3-295.3 248.7-295.3 65.5 0 120.1 43.1 161.2 43.1 39.2 0 100.3-45.7 175.4-45.7 28.3 0 130 2.6 197.2 99.5zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.3 31.7-56.4 83-56.4 135.1 0 7.8.7 15.6 1.3 18.2 2.6.5 6.4.6 10.2.6 45.9 0 103.7-30.4 140.8-70.3z" />
    </svg>
  );
}

function GoogleCalendarLogo({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/google-calendar.svg" alt="" className={className} />;
}

function OutlookLogo({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/outlook-logo.svg" alt="" className={className} />;
}

function formatEventsAsText(events: DeadlineEvent[]): string {
  const groups = new Map<string, DeadlineEvent[]>();
  for (const event of events) {
    const course = event.course || "Uncategorized";
    if (!groups.has(course)) groups.set(course, []);
    groups.get(course)!.push(event);
  }
  const lines: string[] = [];
  for (const [course, courseEvents] of groups) {
    lines.push(course);
    for (const e of courseEvents) {
      const [y, m, d] = e.date.split("-").map(Number);
      const dateStr = new Date(y, m - 1, d).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const timeStr = e.time ? ` at ${e.time}` : "";
      lines.push(`  - ${e.title} — ${dateStr}${timeStr}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

export function ExportStep({ events, onReset }: ExportStepProps) {
  const courseCount = new Set(events.map((e) => e.course).filter(Boolean)).size;
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [copied, setCopied] = useState(false);

  function handleDownload(e: React.MouseEvent) {
    e.preventDefault();
    const blob = generateICS(events);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "deadlines-all-courses.ics";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  async function handleCopyText() {
    await navigator.clipboard.writeText(formatEventsAsText(events));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  // Pre-generate blob URL — used by mobile <a> tags and programmatic downloads
  const blobUrl = useMemo(() => {
    const blob = generateICS(events);
    return URL.createObjectURL(blob);
  }, [events]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => URL.revokeObjectURL(blobUrl);
  }, [blobUrl]);

  const linkClasses =
    "flex items-center justify-center gap-2.5 rounded-md bg-foreground px-6 py-2.5 text-sm font-medium text-background hover:opacity-90 transition-opacity no-underline";
  const secondaryClasses =
    "flex items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-muted hover:bg-foreground/5 transition-colors no-underline";

  return (
    <div className="animate-fade-in-up flex flex-col items-center py-12">
      <CheckCircleFill className="text-accent" size={64} />

      <h2 className="mt-6 text-2xl font-bold tracking-tight">
        Your calendar is ready!
      </h2>
      <p className="mt-2 text-sm text-muted">
        {events.length} event{events.length !== 1 ? "s" : ""}
        {courseCount > 1 && ` from ${courseCount} courses`}
        {" "}will be added to your calendar.
      </p>

      <div className="mt-8 flex flex-col items-center gap-3">
        {/* Platform-specific primary button — real <a> tags for mobile compatibility */}
        {platform === "ios" ? (
          <a href={blobUrl} className={linkClasses}>
            <AppleLogo className="h-4 w-4" />
            Add to Apple Calendar
          </a>
        ) : platform === "android" ? (
          <a href={blobUrl} className={linkClasses}>
            <GoogleCalendarLogo className="h-4 w-4" />
            Add to Google Calendar
          </a>
        ) : (
          // eslint-disable-next-line @next/next/no-html-link-for-pages
          <a href="#" onClick={handleDownload} className={linkClasses}>
            <Download className="h-4 w-4" />
            Download .ics
          </a>
        )}

        {/* Outlook button — mobile only, uses OS app picker to open Outlook if installed */}
        {platform !== "desktop" && (
          <a href={blobUrl} className={secondaryClasses}>
            <OutlookLogo className="h-3.5 w-3.5" />
            Add to Outlook
          </a>
        )}

        {/* Secondary download option for mobile users */}
        {platform !== "desktop" && (
          // eslint-disable-next-line @next/next/no-html-link-for-pages
          <a href="#" onClick={handleDownload} className={secondaryClasses}>
            <Download className="h-3.5 w-3.5" />
            Download .ics file instead
          </a>
        )}

        {/* Copy as text */}
        <button onClick={handleCopyText} className={secondaryClasses}>
          {copied ? (
            <CheckCircleFill className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "Copied!" : "Copy as text"}
        </button>
      </div>

      {/* Usage tip */}
      <p className="mt-6 max-w-xs text-center text-xs text-muted">
        {platform === "desktop"
          ? "Tip: Double-click or drag-and-drop the downloaded file to import into any calendar app, including Outlook."
          : "Tip: Tap a button above and your calendar app will ask to add the events."}
      </p>

      <button
        onClick={onReset}
        className="mt-4 rounded-md border border-border px-4 py-2.5 text-sm text-muted hover:bg-foreground/5 transition-colors"
      >
        Start Over
      </button>
    </div>
  );
}
