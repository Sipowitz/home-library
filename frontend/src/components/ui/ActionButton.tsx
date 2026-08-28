import { forwardRef, type ButtonHTMLAttributes } from "react";

export type ActionButtonVariant =
  | "primary"
  | "addPrimary"
  | "secondary"
  | "utility"
  | "danger"
  | "dangerStrong"
  | "warningStrong"
  | "tertiary"
  | "icon";

export type ActionButtonSize = "sm" | "md" | "lg" | "icon" | "iconSm";

const baseClasses =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 disabled:cursor-not-allowed disabled:opacity-50";

const variantClasses: Record<ActionButtonVariant, string> = {
  primary:
    "bg-blue-600 text-white shadow-[0_8px_20px_rgba(37,99,235,0.22)] hover:bg-blue-500",
  addPrimary:
    "bg-green-600 text-white shadow-[0_8px_20px_rgba(22,163,74,0.18)] hover:bg-green-500",
  secondary:
    "border border-blue-500/35 bg-blue-500/10 text-blue-100 hover:border-blue-400/50 hover:bg-blue-500/20",
  utility:
    "border border-violet-500/30 bg-violet-500/10 text-violet-200 hover:border-violet-400/45 hover:bg-violet-500/20",
  danger:
    "border border-red-500/25 bg-red-500/[0.08] text-red-300 hover:border-red-500/40 hover:bg-red-500/15",
  dangerStrong: "bg-red-600 text-white hover:bg-red-500",
  warningStrong: "bg-yellow-600 text-white hover:bg-yellow-700",
  tertiary:
    "border border-gray-700 bg-gray-800/70 text-gray-300 hover:border-gray-600 hover:bg-gray-700 hover:text-white",
  icon:
    "border border-white/15 bg-black/35 text-gray-200 backdrop-blur-md hover:bg-black/50 hover:text-white",
};

const sizeClasses: Record<ActionButtonSize, string> = {
  sm: "min-h-9 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "min-h-11 px-5 text-sm font-semibold",
  icon: "h-10 w-10 p-0",
  iconSm: "h-9 w-9 p-0",
};

export function actionButtonClasses({
  variant = "tertiary",
  size = "md",
  className = "",
}: {
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
  className?: string;
} = {}) {
  return `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`.trim();
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
};

export const ActionButton = forwardRef<HTMLButtonElement, Props>(
  function ActionButton(
    { variant = "tertiary", size = "md", className, type = "button", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={actionButtonClasses({ variant, size, className })}
        {...props}
      />
    );
  },
);

export const statusActionBaseClasses =
  "inline-flex rounded-full border px-2 py-1 text-[11px] font-medium transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 disabled:cursor-not-allowed disabled:opacity-50";
