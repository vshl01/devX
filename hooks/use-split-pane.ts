"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MIN_PERCENT = 28;
const MAX_PERCENT = 68;
const DEFAULT_PERCENT = 44;
const KEYBOARD_STEP = 4;

export interface UseSplitPane {
  /** Width of the left pane, as a percentage of the container. */
  percent: number;
  dragging: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  handleProps: {
    role: "separator";
    tabIndex: 0;
    "aria-orientation": "vertical";
    "aria-valuenow": number;
    "aria-valuemin": number;
    "aria-valuemax": number;
    "aria-label": string;
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
    onDoubleClick: () => void;
  };
}

/** Pointer and keyboard resizing for the desktop split. */
export function useSplitPane(): UseSplitPane {
  const [percent, setPercent] = useState(DEFAULT_PERCENT);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const clamp = (value: number) => Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, value));

  const applyFromClientX = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    if (bounds.width === 0) return;
    setPercent(clamp(((clientX - bounds.left) / bounds.width) * 100));
  }, []);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    event.preventDefault();
    draggingRef.current = true;
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (event: PointerEvent) => {
      if (!draggingRef.current) return;
      applyFromClientX(event.clientX);
    };
    const onUp = () => {
      draggingRef.current = false;
      setDragging(false);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [applyFromClientX, dragging]);

  const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setPercent((current) => clamp(current - KEYBOARD_STEP));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setPercent((current) => clamp(current + KEYBOARD_STEP));
    } else if (event.key === "Home") {
      event.preventDefault();
      setPercent(MIN_PERCENT);
    } else if (event.key === "End") {
      event.preventDefault();
      setPercent(MAX_PERCENT);
    }
  }, []);

  return {
    percent,
    dragging,
    containerRef,
    handleProps: {
      role: "separator",
      tabIndex: 0,
      "aria-orientation": "vertical",
      "aria-valuenow": Math.round(percent),
      "aria-valuemin": MIN_PERCENT,
      "aria-valuemax": MAX_PERCENT,
      "aria-label": "Resize the document and insights panes",
      onPointerDown,
      onKeyDown,
      onDoubleClick: () => setPercent(DEFAULT_PERCENT),
    },
  };
}
