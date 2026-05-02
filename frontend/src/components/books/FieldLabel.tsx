import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export function FieldLabel({ children }: Props) {
  return (
    <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">
      {children}
    </div>
  );
}
