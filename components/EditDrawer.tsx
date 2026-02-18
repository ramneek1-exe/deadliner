"use client";

import { useState, useCallback } from "react";
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
  const [course, setCourse] = useState(event.course);

  const handleSave = () => {
    onSave({
      ...event,
      title,
      notes,
      date,
      time: time || null,
      type,
      weight,
      course,
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
                  className="rounded-md border border-border px-4 py-2.5 text-xs text-muted hover:bg-foreground/5 transition-colors"
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

          <div>
            <label className="mb-1.5 block text-sm font-medium">Course</label>
            <input
              type="text"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
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
  const [closing, setClosing] = useState(false);

  const handleClose = useCallback(() => {
    if (!closing) setClosing(true);
  }, [closing]);

  const handleAnimationEnd = useCallback(
    (e: React.AnimationEvent<HTMLDivElement>) => {
      // Only respond to our own animation, not bubbled events from children
      if (e.target !== e.currentTarget) return;
      if (closing) {
        setClosing(false);
        onClose();
      }
    },
    [closing, onClose]
  );

  const isOpen = event !== null;
  if (!isOpen && !closing) return null;

  const isExiting = closing;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.4)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          animation: `${isExiting ? "drawerBackdropOut" : "drawerBackdropIn"} ${isExiting ? "0.25s" : "0.25s"} ease-out both`,
        }}
        onClick={handleClose}
      />

      {/* Drawer */}
      <div
        className={`fixed inset-x-0 bottom-0 top-auto rounded-t-xl max-h-[85vh] sm:top-0 sm:bottom-auto sm:right-0 sm:left-auto sm:rounded-none sm:max-h-full z-50 flex sm:h-full w-full max-w-full sm:max-w-md flex-col bg-background border border-border ${isExiting ? "drawer-panel-exit" : "drawer-panel"}`}
        style={{
          boxShadow: "-12px 0 40px rgba(0, 0, 0, 0.2), -2px 0 8px rgba(0, 0, 0, 0.1)",
          animation: isExiting
            ? "drawerSlideOut 0.25s cubic-bezier(0.4, 0, 1, 1) both"
            : "drawerSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) both",
        }}
        onAnimationEnd={handleAnimationEnd}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold">Edit Event</h2>
          <button
            onClick={handleClose}
            className="rounded-md p-2 hover:bg-foreground/5 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {event && (
          <EditForm key={event.id} event={event} onSave={onSave} onClose={handleClose} />
        )}
      </div>
    </>
  );
}
