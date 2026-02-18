"use client";

import { useState } from "react";
import { Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
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

function groupByCourse(events: DeadlineEvent[]): Map<string, DeadlineEvent[]> {
  const map = new Map<string, DeadlineEvent[]>();
  for (const event of events) {
    const course = event.course || "Uncategorized";
    const list = map.get(course);
    if (list) {
      list.push(event);
    } else {
      map.set(course, [event]);
    }
  }
  return map;
}

export function ReviewStep({
  events,
  onEventsChange,
  onExport,
  onReset,
}: ReviewStepProps) {
  const [editingEvent, setEditingEvent] = useState<DeadlineEvent | null>(null);
  const [collapsedCourses, setCollapsedCourses] = useState<Set<string>>(
    new Set()
  );
  const [editingCourseName, setEditingCourseName] = useState<string | null>(
    null
  );
  const [courseNameDraft, setCourseNameDraft] = useState<string>("");
  const [editingField, setEditingField] = useState<{
    id: string;
    field: "date" | "time";
  } | null>(null);

  const handleDelete = (id: string) => {
    onEventsChange(events.filter((e) => e.id !== id));
  };

  const handleInlineUpdate = (
    id: string,
    field: "date" | "time",
    value: string
  ) => {
    onEventsChange(
      events.map((e) =>
        e.id === id
          ? { ...e, [field]: field === "time" && !value ? null : value }
          : e
      )
    );
    setEditingField(null);
  };

  const handleSave = (updated: DeadlineEvent) => {
    onEventsChange(events.map((e) => (e.id === updated.id ? updated : e)));
    setEditingEvent(null);
  };

  const toggleCourse = (course: string) => {
    setCollapsedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(course)) {
        next.delete(course);
      } else {
        next.add(course);
      }
      return next;
    });
  };

  const startEditingCourseName = (course: string) => {
    setEditingCourseName(course);
    setCourseNameDraft(course);
  };

  const commitCourseNameEdit = () => {
    if (
      editingCourseName === null ||
      courseNameDraft.trim() === "" ||
      courseNameDraft.trim() === editingCourseName
    ) {
      setEditingCourseName(null);
      return;
    }
    const newName = courseNameDraft.trim();
    onEventsChange(
      events.map((e) =>
        e.course === editingCourseName ? { ...e, course: newName } : e
      )
    );
    // Update collapsed state if the old name was collapsed
    setCollapsedCourses((prev) => {
      if (prev.has(editingCourseName!)) {
        const next = new Set(prev);
        next.delete(editingCourseName!);
        next.add(newName);
        return next;
      }
      return prev;
    });
    setEditingCourseName(null);
  };

  const cancelCourseNameEdit = () => {
    setEditingCourseName(null);
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

  const courseGroups = groupByCourse(events);
  const courseCount = courseGroups.size;

  return (
    <div className="animate-fade-in-up">
      {/* Summary header */}
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold tracking-tight">
          Found {events.length} deadline{events.length !== 1 ? "s" : ""}
          {courseCount > 1 ? ` across ${courseCount} courses` : ""}
        </h2>
        <p className="mt-1 text-sm text-muted">
          Review, edit, or remove events before exporting.
        </p>
      </div>

      {/* Course sections */}
      <div className="flex flex-col gap-4">
        {Array.from(courseGroups.entries()).map(
          ([course, courseEvents]) => {
            const isCollapsed = collapsedCourses.has(course);
            const isEditing = editingCourseName === course;

            return (
              <div
                key={course}
                className="rounded-lg border border-border"
              >
                {/* Course header */}
                <div className="flex items-center gap-2 px-4 py-3">
                  <button
                    onClick={() => toggleCourse(course)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
                    )}
                    {isEditing ? (
                      <span onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={courseNameDraft}
                          onChange={(e) => setCourseNameDraft(e.target.value)}
                          onBlur={commitCourseNameEdit}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitCourseNameEdit();
                            if (e.key === "Escape") cancelCourseNameEdit();
                          }}
                          autoFocus
                          className="rounded border border-border bg-transparent px-2 py-0.5 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-foreground/20"
                        />
                      </span>
                    ) : (
                      <span className="font-semibold truncate">{course}</span>
                    )}
                    <span className="shrink-0 text-xs text-muted">
                      {courseEvents.length} deadline
                      {courseEvents.length !== 1 ? "s" : ""}
                    </span>
                  </button>
                  {!isEditing && (
                    <button
                      onClick={() => startEditingCourseName(course)}
                      className="rounded-md p-1.5 hover:bg-foreground/5 transition-colors shrink-0"
                      title="Edit course name"
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted" />
                    </button>
                  )}
                </div>

                {/* Section content */}
                {!isCollapsed && (
                  <>
                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-t border-border">
                            <th className="px-4 py-2.5 font-medium text-muted">
                              Title
                            </th>
                            <th className="px-4 py-2.5 font-medium text-muted">
                              Date
                            </th>
                            <th className="px-4 py-2.5 font-medium text-muted">
                              Time
                            </th>
                            <th className="px-4 py-2.5 font-medium text-muted">
                              Type
                            </th>
                            <th className="px-4 py-2.5 font-medium text-muted">
                              Weight
                            </th>
                            <th className="px-4 py-2.5 font-medium text-muted w-20">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {courseEvents.map((event) => (
                            <tr
                              key={event.id}
                              className="border-t border-border last:border-b-0"
                            >
                              <td className="px-4 py-2.5 font-medium">
                                {event.title}
                              </td>
                              <td className="px-4 py-2.5 text-muted">
                                {editingField?.id === event.id &&
                                editingField.field === "date" ? (
                                  <input
                                    type="date"
                                    defaultValue={event.date}
                                    autoFocus
                                    onChange={(e) =>
                                      handleInlineUpdate(
                                        event.id,
                                        "date",
                                        e.target.value
                                      )
                                    }
                                    onBlur={() => setEditingField(null)}
                                    className="rounded border border-border bg-background px-2 py-0.5 text-sm outline-none focus:border-foreground"
                                  />
                                ) : (
                                  <button
                                    onClick={() =>
                                      setEditingField({
                                        id: event.id,
                                        field: "date",
                                      })
                                    }
                                    className="hover:underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
                                  >
                                    {formatDate(event.date)}
                                  </button>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-muted">
                                {editingField?.id === event.id &&
                                editingField.field === "time" ? (
                                  <input
                                    type="time"
                                    defaultValue={event.time ?? ""}
                                    autoFocus
                                    onChange={(e) =>
                                      handleInlineUpdate(
                                        event.id,
                                        "time",
                                        e.target.value
                                      )
                                    }
                                    onBlur={() => setEditingField(null)}
                                    className="rounded border border-border bg-background px-2 py-0.5 text-sm outline-none focus:border-foreground"
                                  />
                                ) : (
                                  <button
                                    onClick={() =>
                                      setEditingField({
                                        id: event.id,
                                        field: "time",
                                      })
                                    }
                                    className="hover:underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
                                  >
                                    {formatTime(event.time)}
                                  </button>
                                )}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="inline-block rounded border border-border px-2 py-0.5 text-xs text-muted">
                                  {TYPE_LABELS[event.type] ?? event.type}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-muted">
                                {event.weight || "\u2014"}
                              </td>
                              <td className="px-4 py-2.5">
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
                    <div className="flex flex-col gap-3 p-3 md:hidden">
                      {courseEvents.map((event) => (
                        <div
                          key={event.id}
                          className="rounded-lg border border-border p-4"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium">{event.title}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-x-1 text-sm text-muted">
                                {editingField?.id === event.id &&
                                editingField.field === "date" ? (
                                  <input
                                    type="date"
                                    defaultValue={event.date}
                                    autoFocus
                                    onChange={(e) =>
                                      handleInlineUpdate(
                                        event.id,
                                        "date",
                                        e.target.value
                                      )
                                    }
                                    onBlur={() => setEditingField(null)}
                                    className="rounded border border-border bg-background px-2 py-0.5 text-sm outline-none focus:border-foreground"
                                  />
                                ) : (
                                  <button
                                    onClick={() =>
                                      setEditingField({
                                        id: event.id,
                                        field: "date",
                                      })
                                    }
                                    className="hover:underline underline-offset-4"
                                  >
                                    {formatDate(event.date)}
                                  </button>
                                )}
                                <span>&middot;</span>
                                {editingField?.id === event.id &&
                                editingField.field === "time" ? (
                                  <input
                                    type="time"
                                    defaultValue={event.time ?? ""}
                                    autoFocus
                                    onChange={(e) =>
                                      handleInlineUpdate(
                                        event.id,
                                        "time",
                                        e.target.value
                                      )
                                    }
                                    onBlur={() => setEditingField(null)}
                                    className="rounded border border-border bg-background px-2 py-0.5 text-sm outline-none focus:border-foreground"
                                  />
                                ) : (
                                  <button
                                    onClick={() =>
                                      setEditingField({
                                        id: event.id,
                                        field: "time",
                                      })
                                    }
                                    className="hover:underline underline-offset-4"
                                  >
                                    {formatTime(event.time)}
                                  </button>
                                )}
                              </div>
                              <div className="mt-2 flex items-center gap-2">
                                <span className="inline-block rounded border border-border px-2 py-0.5 text-xs text-muted">
                                  {TYPE_LABELS[event.type] ?? event.type}
                                </span>
                                {event.weight && (
                                  <span className="text-xs text-muted">
                                    {event.weight}
                                  </span>
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
                  </>
                )}
              </div>
            );
          }
        )}
      </div>

      {/* Actions footer */}
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
