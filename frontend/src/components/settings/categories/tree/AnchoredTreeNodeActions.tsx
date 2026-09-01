import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { TreeNodeActions } from "./TreeNodeActions";

type Props = {
  label: string;
  onAdd: () => void;
  onEdit: () => void;
  onDelete: () => void;
  children: ReactNode;
};

type Point = { left: number; top: number };

const GAP = 7;
const BOUNDARY_PADDING = 8;
const CLOSE_DELAY_MS = 120;

function overlapArea(first: DOMRect, second: DOMRect) {
  const width = Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left));
  const height = Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top));
  return width * height;
}

function positionedRect(point: Point, width: number, height: number) {
  return new DOMRect(point.left, point.top, width, height);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function calculatePosition(anchor: HTMLElement, popover: HTMLElement): Point {
  const anchorRect = anchor.getBoundingClientRect();
  const popoverRect = popover.getBoundingClientRect();
  const flowElement = anchor.closest(".react-flow");
  const flowRect = flowElement?.getBoundingClientRect();
  const bounds = {
    left: Math.max(BOUNDARY_PADDING, (flowRect?.left ?? 0) + BOUNDARY_PADDING),
    right: Math.min(window.innerWidth - BOUNDARY_PADDING, (flowRect?.right ?? window.innerWidth) - BOUNDARY_PADDING),
    top: Math.max(BOUNDARY_PADDING, (flowRect?.top ?? 0) + BOUNDARY_PADDING),
    bottom: Math.min(window.innerHeight - BOUNDARY_PADDING, (flowRect?.bottom ?? window.innerHeight) - BOUNDARY_PADDING),
  };
  const width = popoverRect.width;
  const height = popoverRect.height;
  const centeredTop = clamp(anchorRect.top + (anchorRect.height - height) / 2, bounds.top, bounds.bottom - height);
  const centeredLeft = clamp(anchorRect.left + (anchorRect.width - width) / 2, bounds.left, bounds.right - width);
  const candidates = [
    { left: centeredLeft, top: anchorRect.bottom + GAP },
    { left: centeredLeft, top: anchorRect.top - GAP - height },
    { left: anchorRect.left - GAP - width, top: centeredTop },
    { left: anchorRect.right + GAP, top: centeredTop },
  ].filter((point) => (
    point.left >= bounds.left
    && point.left + width <= bounds.right
    && point.top >= bounds.top
    && point.top + height <= bounds.bottom
  ));
  const neighboringNodes = flowElement
    ? [...flowElement.querySelectorAll<HTMLElement>(".react-flow__node")]
      .filter((node) => !node.contains(anchor))
      .map((node) => node.getBoundingClientRect())
    : [];
  const scored = candidates.map((point) => ({
    point,
    overlap: neighboringNodes.reduce(
      (total, nodeRect) => total + overlapArea(positionedRect(point, width, height), nodeRect),
      0,
    ),
  }));

  const collisionFree = scored.find((candidate) => candidate.overlap === 0);
  if (collisionFree) return collisionFree.point;
  if (scored.length > 0) {
    return scored.reduce((best, candidate) => candidate.overlap < best.overlap ? candidate : best).point;
  }
  return {
    left: centeredLeft,
    top: clamp(anchorRect.bottom + GAP, bounds.top, bounds.bottom - height),
  };
}

export function AnchoredTreeNodeActions({ label, onAdd, onEdit, onDelete, children }: Props) {
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Point | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<number | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);
  const show = useCallback(() => {
    cancelClose();
    setPosition(null);
    setOpen(true);
  }, [cancelClose]);
  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  }, [cancelClose]);
  const closeAndRun = useCallback((action: () => void) => {
    setOpen(false);
    action();
  }, []);

  useEffect(() => {
    if (!open || !anchor) return;

    let frame = 0;
    const update = () => {
      if (popoverRef.current) {
        const next = calculatePosition(anchor, popoverRef.current);
        setPosition((current) => current?.left === next.left && current.top === next.top ? current : next);
      }
      frame = window.requestAnimationFrame(update);
    };
    frame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frame);
  }, [anchor, open]);

  useEffect(() => () => cancelClose(), [cancelClose]);

  return (
    <>
      <div
        ref={setAnchor}
        className="h-10 w-[150px]"
        onMouseEnter={show}
        onMouseLeave={scheduleClose}
      >
        {children}
      </div>
      {open && createPortal(
        <div
          ref={popoverRef}
          className="group fixed z-[100] rounded-md border border-border bg-surface/95 p-0.5 shadow-lg backdrop-blur-sm"
          style={{
            left: position?.left ?? 0,
            top: position?.top ?? 0,
            visibility: position ? "visible" : "hidden",
          }}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <TreeNodeActions
            label={label}
            alwaysVisible
            onAdd={() => closeAndRun(onAdd)}
            onEdit={() => closeAndRun(onEdit)}
            onDelete={() => closeAndRun(onDelete)}
          />
        </div>,
        document.body,
      )}
    </>
  );
}
