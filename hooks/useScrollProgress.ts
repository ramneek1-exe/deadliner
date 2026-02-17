"use client";

import { useSyncExternalStore, useCallback } from "react";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function useScrollProgress(scrollDistance: number): number {
  const subscribe = useCallback((callback: () => void) => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          callback();
          ticking = false;
        });
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const getSnapshot = useCallback(() => {
    return clamp(window.scrollY / scrollDistance, 0, 1);
  }, [scrollDistance]);

  const getServerSnapshot = useCallback(() => 0, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
