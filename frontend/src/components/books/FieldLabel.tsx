import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export function FieldLabel({ children }: Props) {
  return (
    <div className="mb-1 text-[11px] uppercase tracking-wide text-text-muted">
      {children}
    </div>
  );
}
