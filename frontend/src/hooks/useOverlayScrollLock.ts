import { useLayoutEffect } from "react";

type Snapshot = {
  x: number;
  y: number;
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  overflow: string;
};

let activeLocks = 0;
let snapshot: Snapshot | null = null;

function lock() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (activeLocks++ > 0) return;

  const body = document.body;
  snapshot = {
    x: window.scrollX,
    y: window.scrollY,
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    overflow: body.style.overflow,
  };

  body.style.position = "fixed";
  body.style.top = `${-snapshot.y}px`;
  body.style.left = `${-snapshot.x}px`;
  body.style.right = "0";
  body.style.width = "100%";
  body.style.overflow = "hidden";
}

function unlock() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  activeLocks = Math.max(0, activeLocks - 1);
  if (activeLocks !== 0 || !snapshot) return;

  const previous = snapshot;
  snapshot = null;
  const body = document.body;
  body.style.position = previous.position;
  body.style.top = previous.top;
  body.style.left = previous.left;
  body.style.right = previous.right;
  body.style.width = previous.width;
  body.style.overflow = previous.overflow;
  window.scrollTo(previous.x, previous.y);
}

/** Keep the page beneath an overlay fixed without disturbing its exact viewport. */
export function useOverlayScrollLock(open: boolean) {
  useLayoutEffect(() => {
    if (!open) return;
    lock();
    return unlock;
  }, [open]);
}
