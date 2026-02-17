"use client";

import { useMemo } from "react";
import { useScrollProgress } from "@/hooks/useScrollProgress";

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

interface HeroHeaderProps {
  children?: React.ReactNode;
}

const SCROLL_DISTANCE = 600;
const HEADER_HEIGHT = 64;

// Gentle damping — slow start, smooth middle, soft landing
function easeInOutQuad(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

const BLURBS = [
  "too many deadlines to focus on?",
  "can't keep track of your assignments?",
  "oh shoot! when was the final exam?",
  "Dang it! I missed the project proposal deadline!",
  "wait, was that due today or tomorrow?",
  "I swear the midterm was next week...",
  "did anyone else forget about the lab report?",
  "three assignments due the same day?!",
];

const TIME_PER_BLURB = 5; // seconds each blurb is on screen
const TOTAL_CYCLE = BLURBS.length * TIME_PER_BLURB; // 40s full rotation

interface BlurbConfig {
  text: string;
  x: number;
  y: number;
  dx1: number;
  dy1: number;
  dx2: number;
  dy2: number;
  dx3: number;
  dy3: number;
  floatDuration: number;
  delay: number;
}

function generateBlurbConfigs(): BlurbConfig[] {
  const rand = seededRandom(42);

  // Place blurbs OUTSIDE the center title/tagline zone
  // Keep x: 15-85%, y: 15-85% so drift doesn't push them off viewport
  const positions: Array<{ x: number; y: number }> = [
    { x: 15 + rand() * 8, y: 15 + rand() * 6 },
    { x: 75 + rand() * 10, y: 15 + rand() * 6 },
    { x: 15 + rand() * 8, y: 35 + rand() * 6 },
    { x: 75 + rand() * 10, y: 35 + rand() * 6 },
    { x: 15 + rand() * 8, y: 58 + rand() * 6 },
    { x: 75 + rand() * 10, y: 58 + rand() * 6 },
    { x: 18 + rand() * 10, y: 75 + rand() * 8 },
    { x: 72 + rand() * 10, y: 75 + rand() * 8 },
  ];

  return BLURBS.map((text, i) => ({
    text,
    x: positions[i].x,
    y: positions[i].y,
    dx1: (rand() - 0.5) * 140,
    dy1: (rand() - 0.5) * 90,
    dx2: (rand() - 0.5) * 120,
    dy2: (rand() - 0.5) * 80,
    dx3: (rand() - 0.5) * 140,
    dy3: (rand() - 0.5) * 90,
    floatDuration: 10 + rand() * 6,
    delay: i * TIME_PER_BLURB,
  }));
}

export function HeroHeader({ children }: HeroHeaderProps) {
  const rawT = useScrollProgress(SCROLL_DISTANCE);
  const t = easeInOutQuad(rawT);

  const blurbConfigs = useMemo(() => generateBlurbConfigs(), []);

  // Tagline fades out from 15-35% of scroll
  const taglineOpacity = t < 0.15 ? 1 : Math.max(0, 1 - (t - 0.15) / 0.2);

  // Blurbs fade away BEFORE title animation (0-10%)
  const blurbOpacity = Math.max(0, 1 - t / 0.1);

  // Header background fades in from 50-100%
  const headerBgOpacity = t < 0.5 ? 0 : (t - 0.5) / 0.5;
  const borderOpacity = headerBgOpacity;

  // Step indicator fades in from 60-90%
  const childrenOpacity = t < 0.6 ? 0 : Math.min(1, (t - 0.6) / 0.3);

  // Title scale: smoothly from 1 → 0.22
  const titleScale = lerp(1, 0.22, t);

  // Sticky container height
  const containerVh = lerp(100, 0, t);

  return (
    <div style={{ height: "115vh" }}>
      {/* Sticky container */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          height: containerVh > 0 ? `${containerVh}vh` : `${HEADER_HEIGHT}px`,
          minHeight: `${HEADER_HEIGHT}px`,
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
          willChange: "height",
          contain: "layout style",
        }}
      >
        {/* Floating blurbs */}
        {blurbOpacity > 0.01 && (
          <div
            className="hidden sm:block"
            style={{
              position: "absolute",
              inset: 0,
              opacity: blurbOpacity,
              pointerEvents: "none",
            }}
          >
            {blurbConfigs.map((b, i) => (
              <span
                key={i}
                className="blurb-hidden"
                style={{
                  position: "absolute",
                  left: `${b.x}%`,
                  top: `${b.y}%`,
                  fontFamily: "var(--font-geist-pixel-square), monospace",
                  fontSize: "clamp(0.8rem, 1.6vw, 1.1rem)",
                  color: "#d4d4d4",
                  whiteSpace: "nowrap",
                  maxWidth: "35vw",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  animationName: "blurbFloat, blurbSequence",
                  animationDuration: `${b.floatDuration}s, ${TOTAL_CYCLE}s`,
                  animationTimingFunction: "ease-in-out, linear",
                  animationDelay: `0s, ${b.delay}s`,
                  animationIterationCount: "infinite, infinite",
                  animationFillMode: "none, both",
                  "--dx1": `${b.dx1}px`,
                  "--dy1": `${b.dy1}px`,
                  "--dx2": `${b.dx2}px`,
                  "--dy2": `${b.dy2}px`,
                  "--dx3": `${b.dx3}px`,
                  "--dy3": `${b.dy3}px`,
                } as React.CSSProperties}
              >
                {b.text}
              </span>
            ))}
          </div>
        )}

        {/* Header background + border */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: `rgba(var(--background-rgb), ${headerBgOpacity * 0.85})`,
            backdropFilter: headerBgOpacity > 0 ? `blur(${lerp(0, 12, headerBgOpacity)}px)` : "none",
            WebkitBackdropFilter: headerBgOpacity > 0 ? `blur(${lerp(0, 12, headerBgOpacity)}px)` : "none",
            borderBottom: `1px solid rgba(var(--border-rgb), ${borderOpacity})`,
            pointerEvents: "none",
          }}
        />

        {/* Scroll indicator — slides up slightly and fades out on scroll */}
        <div
          style={{
            position: "absolute",
            bottom: "1.5rem",
            left: "50%",
            transform: `translateX(-50%) translateY(${lerp(0, -12, Math.min(t / 0.1, 1))}px)`,
            display: t > 0.12 ? "none" : "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
            opacity: Math.max(0, 1 - t / 0.1),
            pointerEvents: "none",
          }}
        >
            <span
              style={{
                fontSize: "0.75rem",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: "var(--muted)",
              }}
            >
              Scroll down
            </span>
            <svg
              width="20"
              height="28"
              viewBox="0 0 20 28"
              fill="none"
              style={{ color: "var(--muted)" }}
            >
              {/* Mouse outline */}
              <rect
                x="1"
                y="1"
                width="18"
                height="26"
                rx="9"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              {/* Scroll wheel dot — animated */}
              <circle
                className="scroll-dot"
                cx="10"
                cy="8"
                r="2"
                fill="currentColor"
              />
            </svg>
          </div>

        {/* Content row */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            padding: "0 clamp(16px, 4vw, 24px)",
          }}
        >
          {/* Title group — pure transform centering avoids layout thrashing.
              translateX(calc(factor * (50vw - 50% - 24px))) centers via compositor only:
              50vw = half viewport, 50% = half self-width, 24px = left padding offset */}
          <div
            style={{
              position: "relative",
              willChange: "transform",
              transform: `translateX(calc(${(1 - t).toFixed(4)} * (50vw - 50% - 24px)))`,
            }}
          >
            <h1
              style={{
                fontSize: "clamp(3rem, 12vw, 8rem)",
                transform: `scale(${titleScale})`,
                transformOrigin: "left center",
                fontWeight: 800,
                letterSpacing: "-0.05em",
                lineHeight: 1,
                margin: 0,
                whiteSpace: "nowrap",
                willChange: "transform",
              }}
            >
              Deadliner
            </h1>

            {/* Tagline — absolute so it doesn't push the title upward */}
            <p
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                opacity: taglineOpacity,
                fontSize: "clamp(0.8rem, 2vw, 1.1rem)",
                color: "var(--muted)",
                margin: 0,
                marginTop: "12px",
                transformOrigin: "left top",
                transform: `scale(${lerp(1, 0.6, t)})`,
                pointerEvents: taglineOpacity < 0.1 ? "none" : "auto",
                whiteSpace: "nowrap",
              }}
            >
              Syllabus to calendar in seconds.
            </p>
          </div>

          {/* Step indicator slot */}
          <div
            style={{
              opacity: childrenOpacity,
              pointerEvents: childrenOpacity < 0.1 ? "none" : "auto",
              flexShrink: 0,
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
