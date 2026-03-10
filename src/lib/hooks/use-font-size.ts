"use client";

import { useSyncExternalStore, useCallback } from "react";

const FONT_SIZE_KEY = "innoclaw-font-size";
const DEFAULT_FONT_SIZE = 16;
const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 24;
const STEP = 2;

let listeners: Array<() => void> = [];
function emitChange() {
  for (const l of listeners) l();
}
function subscribe(cb: () => void) {
  listeners = [...listeners, cb];
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

function getSnapshot(): number {
  const stored = localStorage.getItem(FONT_SIZE_KEY);
  if (stored) {
    const parsed = Number(stored);
    if (!isNaN(parsed) && parsed >= MIN_FONT_SIZE && parsed <= MAX_FONT_SIZE) {
      return parsed;
    }
  }
  return DEFAULT_FONT_SIZE;
}

function getServerSnapshot(): number {
  return DEFAULT_FONT_SIZE;
}

export function useFontSize() {
  const fontSize = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const updateFontSize = useCallback((size: number) => {
    const clamped = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, size));
    localStorage.setItem(FONT_SIZE_KEY, String(clamped));
    document.documentElement.style.fontSize = `${clamped}px`;
    emitChange();
  }, []);

  const increase = useCallback(() => updateFontSize(fontSize + STEP), [fontSize, updateFontSize]);
  const decrease = useCallback(() => updateFontSize(fontSize - STEP), [fontSize, updateFontSize]);
  const reset = useCallback(() => updateFontSize(DEFAULT_FONT_SIZE), [updateFontSize]);

  return {
    fontSize,
    setFontSize: updateFontSize,
    increase,
    decrease,
    reset,
    min: MIN_FONT_SIZE,
    max: MAX_FONT_SIZE,
    step: STEP,
  };
}
