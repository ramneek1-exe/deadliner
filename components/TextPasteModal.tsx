"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface TextPasteModalProps {
  onAdd: (text: string, courseName: string) => void;
  onClose: () => void;
}

export function TextPasteModal({ onAdd, onClose }: TextPasteModalProps) {
  const [text, setText] = useState("");
  const [courseName, setCourseName] = useState("");

  const handleSubmit = () => {
    onAdd(text.trim(), courseName.trim());
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-lg rounded-lg border border-border bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Paste Text
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <input
              type="text"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              placeholder="e.g. MATH 201"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-foreground/50 focus:outline-none"
            />
          </div>

          <div>
            <textarea
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your syllabus content here..."
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-foreground/50 focus:outline-none resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={text.trim().length === 0}
              className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity disabled:opacity-40"
            >
              Add to Queue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
