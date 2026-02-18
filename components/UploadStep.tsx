"use client";

import { useState, useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  AlertCircle,
  Loader2,
  X,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Type,
  RotateCcw,
  ClipboardPaste,
} from "lucide-react";
import { CheckCircleFill } from "geist-icons";
import type { DeadlineEvent, FileQueueItem, ParseResponse } from "@/lib/types";
import { TextPasteModal } from "./TextPasteModal";

interface UploadStepProps {
  onEventsExtracted: (events: DeadlineEvent[]) => void;
}

const MAX_FILES = 10;
const MAX_CONCURRENT = 3;

const ACCEPTED_TYPES: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-excel": [".xls"],
  "image/jpeg": [".jpeg", ".jpg"],
  "image/png": [".png"],
  "image/heic": [".heic"],
  "image/heif": [".heif"],
};

function getFileIcon(item: FileQueueItem) {
  if (item.source === "text") return <Type className="h-5 w-5 text-muted" />;
  if (!item.file) return <FileText className="h-5 w-5 text-muted" />;

  const type = item.file.type;
  if (type.startsWith("image/")) return <ImageIcon className="h-5 w-5 text-muted" />;
  if (
    type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    type === "application/vnd.ms-excel"
  )
    return <FileSpreadsheet className="h-5 w-5 text-muted" />;
  return <FileText className="h-5 w-5 text-muted" />;
}

function getStatusIcon(status: FileQueueItem["status"]) {
  switch (status) {
    case "pending":
      return <div className="h-4 w-4 rounded-full border border-border" />;
    case "processing":
      return <Loader2 className="h-4 w-4 animate-spin text-muted" />;
    case "done":
      return <CheckCircleFill className="text-accent" size={16} />;
    case "error":
      return <AlertCircle className="h-4 w-4 text-danger" />;
  }
}

export function UploadStep({ onEventsExtracted }: UploadStepProps) {
  const [queue, setQueue] = useState<FileQueueItem[]>([]);
  const [showTextModal, setShowTextModal] = useState(false);
  const processingCount = useRef<number>(0);
  const startProcessingRef = useRef<(items: FileQueueItem[]) => void>(() => { });

  const processItem = useCallback(async (item: FileQueueItem) => {
    // Mark as processing
    setQueue((prev) =>
      prev.map((q) => (q.id === item.id ? { ...q, status: "processing" as const } : q))
    );

    try {
      const formData = new FormData();
      if (item.source === "file" && item.file) {
        formData.append("type", "file");
        formData.append("file", item.file);
      } else {
        formData.append("type", "text");
        formData.append("text", item.text || "");
      }

      const res = await fetch("/api/parse", {
        method: "POST",
        body: formData,
      });

      const data: ParseResponse = await res.json();

      if (!res.ok) {
        const errData = data as unknown as { error: string };
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? { ...q, status: "error" as const, error: errData.error || "Something went wrong" }
              : q
          )
        );
        return;
      }

      setQueue((prev) =>
        prev.map((q) =>
          q.id === item.id
            ? {
              ...q,
              status: "done" as const,
              events: data.events,
              courseName: q.courseName || data.courseName,
            }
            : q
        )
      );
    } catch {
      setQueue((prev) =>
        prev.map((q) =>
          q.id === item.id
            ? { ...q, status: "error" as const, error: "Network error. Please try again." }
            : q
        )
      );
    } finally {
      processingCount.current--;
      // Try to process more items after one finishes
      setQueue((prev) => {
        const pending = prev.filter((q) => q.status === "pending");
        if (pending.length > 0) {
          setTimeout(() => startProcessingRef.current(pending), 0);
        }
        return prev;
      });
    }
  }, []);

  const startProcessing = useCallback(
    (items: FileQueueItem[]) => {
      for (const item of items) {
        if (item.status !== "pending") continue;
        if (processingCount.current >= MAX_CONCURRENT) break;
        processingCount.current++;
        processItem(item);
      }
    },
    [processItem]
  );
  startProcessingRef.current = startProcessing;

  const addFiles = useCallback(
    (files: File[]) => {
      setQueue((prev) => {
        const remaining = MAX_FILES - prev.length;
        const toAdd = files.slice(0, remaining);
        const newItems: FileQueueItem[] = toAdd.map((file) => ({
          id: crypto.randomUUID(),
          source: "file" as const,
          file,
          courseName: "",
          status: "pending" as const,
          events: [],
        }));
        const updated = [...prev, ...newItems];
        setTimeout(() => startProcessing(newItems), 0);
        return updated;
      });
    },
    [startProcessing]
  );

  const addText = useCallback(
    (text: string, courseName: string) => {
      setQueue((prev) => {
        if (prev.length >= MAX_FILES) return prev;
        const newItem: FileQueueItem = {
          id: crypto.randomUUID(),
          source: "text",
          text,
          courseName,
          status: "pending",
          events: [],
        };
        const updated = [...prev, newItem];
        setTimeout(() => startProcessing([newItem]), 0);
        return updated;
      });
    },
    [startProcessing]
  );

  const removeItem = useCallback((id: string) => {
    setQueue((prev) => prev.filter((q) => q.id !== id));
  }, []);

  const retryItem = useCallback(
    (id: string) => {
      setQueue((prev) => {
        const updated = prev.map((q) =>
          q.id === id ? { ...q, status: "pending" as const, error: undefined } : q
        );
        const item = updated.find((q) => q.id === id);
        if (item) {
          setTimeout(() => startProcessing([item]), 0);
        }
        return updated;
      });
    },
    [startProcessing]
  );

  const updateCourseName = useCallback((id: string, name: string) => {
    setQueue((prev) =>
      prev.map((q) => (q.id === id ? { ...q, courseName: name } : q))
    );
  }, []);

  const handleProceed = useCallback(() => {
    const allEvents: DeadlineEvent[] = [];
    for (const item of queue) {
      if (item.status !== "done") continue;
      for (const event of item.events) {
        allEvents.push(
          item.courseName ? { ...event, course: item.courseName } : event
        );
      }
    }
    onEventsExtracted(allEvents);
  }, [queue, onEventsExtracted]);

  const isFull = queue.length >= MAX_FILES;
  const isProcessing = queue.some((q) => q.status === "processing");
  const doneItems = queue.filter((q) => q.status === "done");
  const totalDeadlines = doneItems.reduce((sum, q) => sum + q.events.length, 0);
  const courseSet = new Set(
    doneItems
      .map((q) => q.courseName || q.events[0]?.course)
      .filter(Boolean)
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      addFiles(acceptedFiles);
    },
    [addFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: 10 * 1024 * 1024,
    multiple: true,
    disabled: isFull,
  });

  return (
    <div className="animate-fade-in-up">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-8 sm:p-16 transition-colors ${isFull
            ? "pointer-events-none border-border opacity-50"
            : isDragActive
              ? "border-foreground bg-foreground/5"
              : "border-border hover:border-foreground/50"
          }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-4">
          <Upload
            className={`h-8 w-8 sm:h-10 sm:w-10 ${isDragActive ? "text-foreground" : "text-muted"
              }`}
          />
          <div className="text-center">
            {isFull ? (
              <p className="text-base sm:text-lg font-medium text-muted">
                Maximum files reached
              </p>
            ) : (
              <>
                <p className="text-base sm:text-lg font-medium text-foreground">
                  Drop your course outlines here
                </p>
                <p className="mt-1 text-sm text-muted">
                  or click to browse. PDF, DOCX, XLSX, or images. Up to 10 files.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Paste text button */}
      <div className="mt-4 flex justify-center">
        <button
          onClick={() => setShowTextModal(true)}
          disabled={isFull}
          className="flex items-center gap-2 rounded-md border border-dashed border-border px-4 py-2.5 text-sm font-medium text-muted hover:border-foreground/50 hover:text-foreground transition-colors disabled:opacity-40"
        >
          <ClipboardPaste className="h-4 w-4" />
          Paste text instead
        </button>
      </div>

      {/* Text paste modal */}
      {showTextModal && (
        <TextPasteModal
          onAdd={addText}
          onClose={() => setShowTextModal(false)}
        />
      )}

      {/* Queue list */}
      {queue.length > 0 && (
        <div className="mt-6 space-y-2">
          {queue.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
            >
              {/* File type icon */}
              {getFileIcon(item)}

              {/* Filename / label */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {item.source === "text"
                    ? "Pasted text"
                    : item.file?.name || "Unknown file"}
                </p>
                {item.status === "error" && item.error && (
                  <p className="truncate text-xs text-danger">{item.error}</p>
                )}
                {item.status === "done" && item.events.length === 0 && (
                  <p className="text-xs text-muted">No deadlines found</p>
                )}
                {item.status === "done" && item.events.length > 0 && (
                  <p className="text-xs text-muted">
                    {item.events.length} deadline{item.events.length !== 1 ? "s" : ""}
                  </p>
                )}
              </div>

              {/* Editable course name (done only) */}
              {item.status === "done" && (
                <input
                  type="text"
                  value={item.courseName}
                  onChange={(e) => updateCourseName(item.id, e.target.value)}
                  placeholder="Course"
                  className="w-24 rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted focus:border-foreground/50 focus:outline-none"
                />
              )}

              {/* Status icon */}
              {getStatusIcon(item.status)}

              {/* Retry button (error only) */}
              {item.status === "error" && (
                <button
                  onClick={() => retryItem(item.id)}
                  className="rounded p-1 text-muted hover:text-foreground transition-colors"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}

              {/* Remove button */}
              <button
                onClick={() => removeItem(item.id)}
                className="rounded p-1 text-muted hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Summary + proceed */}
      {doneItems.length > 0 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-muted">
            Found {totalDeadlines} deadline{totalDeadlines !== 1 ? "s" : ""} across{" "}
            {courseSet.size} course{courseSet.size !== 1 ? "s" : ""}
          </p>
          <button
            onClick={handleProceed}
            disabled={isProcessing}
            className="rounded-md bg-foreground px-5 py-2 text-sm font-medium text-background transition-opacity disabled:opacity-40"
          >
            {isProcessing ? "Processing..." : "Review Deadlines"}
          </button>
        </div>
      )}
    </div>
  );
}
