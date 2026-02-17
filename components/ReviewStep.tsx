"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { EditDrawer } from "@/components/EditDrawer";
import type { DeadlineEvent } from "@/lib/types";

interface ReviewStepProps {
  events: DeadlineEvent[];
  onEventsChange: (events: DeadlineEvent[]) => void;
  onExport: () => void;
  onReset: () => void;
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(time: string | null): string {
  if (!time) return "All day";
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

const TYPE_LABELS: Record<string, string> = {
  Exam: "Exam",
  Assignment: "Asst",
  Reading: "Read",
  Other: "Other",
};

export function ReviewStep({
  events,
  onEventsChange,
  onExport,
  onReset,
}: ReviewStepProps) {
  const [editingEvent, setEditingEvent] = useState<DeadlineEvent | null>(null);

  const handleDelete = (id: string) => {
    onEventsChange(events.filter((e) => e.id !== id));
  };

  const handleSave = (updated: DeadlineEvent) => {
    onEventsChange(events.map((e) => (e.id === updated.id ? updated : e)));
    setEditingEvent(null);
  };

  if (events.length === 0) {
    return (
      <div className="animate-fade-in-up text-center py-16">
        <p className="text-lg font-medium">No events remaining</p>
        <p className="mt-1 text-sm text-muted">
          You&apos;ve removed all events.
        </p>
        <button
          onClick={onReset}
          className="mt-6 rounded-md border border-border px-4 py-2 text-sm hover:bg-foreground/5 transition-colors"
        >
          Start Over
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold tracking-tight">
          We found {events.length} deadline{events.length !== 1 ? "s" : ""}
        </h2>
        <p className="mt-1 text-sm text-muted">
          Review, edit, or remove events before exporting.
        </p>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="pb-3 pr-4 font-medium text-muted">Title</th>
              <th className="pb-3 pr-4 font-medium text-muted">Date</th>
              <th className="pb-3 pr-4 font-medium text-muted">Time</th>
              <th className="pb-3 pr-4 font-medium text-muted">Type</th>
              <th className="pb-3 pr-4 font-medium text-muted">Weight</th>
              <th className="pb-3 font-medium text-muted w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr
                key={event.id}
                className="border-b border-border last:border-0"
              >
                <td className="py-3 pr-4 font-medium">{event.title}</td>
                <td className="py-3 pr-4 text-muted">
                  {formatDate(event.date)}
                </td>
                <td className="py-3 pr-4 text-muted">
                  {formatTime(event.time)}
                </td>
                <td className="py-3 pr-4">
                  <span className="inline-block rounded border border-border px-2 py-0.5 text-xs text-muted">
                    {TYPE_LABELS[event.type] ?? event.type}
                  </span>
                </td>
                <td className="py-3 pr-4 text-muted">
                  {event.weight || "—"}
                </td>
                <td className="py-3">
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditingEvent(event)}
                      className="rounded-md p-1.5 hover:bg-foreground/5 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4 text-muted" />
                    </button>
                    <button
                      onClick={() => handleDelete(event.id)}
                      className="rounded-md p-1.5 hover:bg-danger/10 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-danger" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {events.map((event) => (
          <div
            key={event.id}
            className="rounded-lg border border-border p-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="font-medium">{event.title}</p>
                <p className="mt-1 text-sm text-muted">
                  {formatDate(event.date)} · {formatTime(event.time)}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-block rounded border border-border px-2 py-0.5 text-xs text-muted">
                    {TYPE_LABELS[event.type] ?? event.type}
                  </span>
                  {event.weight && (
                    <span className="text-xs text-muted">{event.weight}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-1 ml-3">
                <button
                  onClick={() => setEditingEvent(event)}
                  className="rounded-md p-2.5 hover:bg-foreground/5 transition-colors"
                >
                  <Pencil className="h-4 w-4 text-muted" />
                </button>
                <button
                  onClick={() => handleDelete(event.id)}
                  className="rounded-md p-2.5 hover:bg-danger/10 transition-colors"
                >
                  <Trash2 className="h-4 w-4 text-danger" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-8 flex items-center justify-center gap-3">
        <button
          onClick={onExport}
          className="rounded-md bg-foreground px-6 py-2.5 text-sm font-medium text-background hover:opacity-90 transition-opacity"
        >
          Export Calendar
        </button>
        <button
          onClick={onReset}
          className="rounded-md border border-border px-4 py-2.5 text-sm text-muted hover:bg-foreground/5 transition-colors"
        >
          Start Over
        </button>
      </div>

      <EditDrawer
        event={editingEvent}
        onSave={handleSave}
        onClose={() => setEditingEvent(null)}
      />
    </div>
  );
}
