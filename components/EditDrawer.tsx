"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { DeadlineEvent, EventType } from "@/lib/types";

interface EditDrawerProps {
  event: DeadlineEvent | null;
  onSave: (updated: DeadlineEvent) => void;
  onClose: () => void;
}

const EVENT_TYPES: EventType[] = ["Exam", "Assignment", "Reading", "Other"];

function EditForm({
  event,
  onSave,
  onClose,
}: {
  event: DeadlineEvent;
  onSave: (updated: DeadlineEvent) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(event.title);
  const [notes, setNotes] = useState(event.notes);
  const [date, setDate] = useState(event.date);
  const [time, setTime] = useState(event.time ?? "");
  const [type, setType] = useState<EventType>(event.type);
  const [weight, setWeight] = useState(event.weight);

  const handleSave = () => {
    onSave({
      ...event,
      title,
      notes,
      date,
      time: time || null,
      type,
      weight,
    });
  };

  return (
    <>
      {/* Form */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="flex flex-col gap-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-foreground"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-foreground resize-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-foreground"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Time
              <span className="ml-1 font-normal text-muted">
                (leave empty for all-day)
              </span>
            </label>
            <div className="flex gap-2">
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-foreground"
              />
              {time && (
                <button
                  onClick={() => setTime("")}
                  className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:bg-foreground/5 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as EventType)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-foreground"
            >
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Weight
              <span className="ml-1 font-normal text-muted">(e.g., 30%)</span>
            </label>
            <input
              type="text"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-foreground"
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex gap-3 border-t border-border px-6 py-4">
        <button
          onClick={handleSave}
          className="flex-1 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 transition-opacity"
        >
          Save
        </button>
        <button
          onClick={onClose}
          className="flex-1 rounded-md border border-border px-4 py-2 text-sm hover:bg-foreground/5 transition-colors"
        >
          Cancel
        </button>
      </div>
    </>
  );
}

export function EditDrawer({ event, onSave, onClose }: EditDrawerProps) {
  const isOpen = event !== null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-background transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold">Edit Event</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-foreground/5 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {event && (
          <EditForm key={event.id} event={event} onSave={onSave} onClose={onClose} />
        )}
      </div>
    </>
  );
}
