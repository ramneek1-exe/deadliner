"use client";

import { useState } from "react";

const FAQ_ITEMS: { question: string; answer: string }[] = [
  {
    question: "What file types are supported?",
    answer:
      "Currently, Deadliner supports PDF files up to 5 MB. Just drag and drop your syllabus or course outline and we'll handle the rest.",
  },
  {
    question: "How does it work?",
    answer:
      "Upload your syllabus PDF, and our AI reads through it to find deadlines, exams, and assignments. You get a clean list to review, edit, or remove items — then export everything as a .ics calendar file.",
  },
  {
    question: "Which calendar apps can I use?",
    answer:
      "The exported .ics file works with Google Calendar, Apple Calendar, Outlook, and any app that supports the iCalendar standard.",
  },
  {
    question: "How accurate is the extraction?",
    answer:
      "It's powered by GPT-4o and handles most syllabus formats well. The review step lets you verify every event before exporting, so you're always in control.",
  },
  {
    question: "Is my data stored anywhere?",
    answer:
      "No. Your file is processed entirely in memory and never saved to a database or disk. Once you leave the page, it's gone.",
  },
];

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (i: number) => {
    setOpenIndex(openIndex === i ? null : i);
  };

  return (
    <section className="mt-16 mb-4">
      <h2 className="text-xl font-bold tracking-tight text-left mb-6">
        Frequently Asked Questions
      </h2>
      <div className="flex flex-col">
        {FAQ_ITEMS.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <div key={i} className="border-t border-border last:border-b">
              <button
                onClick={() => toggle(i)}
                className="flex w-full items-center justify-between py-4 text-left text-base font-medium transition-colors hover:text-muted"
              >
                {item.question}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  className="ml-4 shrink-0 transition-transform duration-200"
                  style={{
                    transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                >
                  <polyline points="4,6 8,10 12,6" />
                </svg>
              </button>
              <div
                className="grid transition-[grid-template-rows] duration-200 ease-out"
                style={{
                  gridTemplateRows: isOpen ? "1fr" : "0fr",
                }}
              >
                <div className="overflow-hidden">
                  <p className="pb-4 text-sm text-muted leading-relaxed">
                    {item.answer}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
