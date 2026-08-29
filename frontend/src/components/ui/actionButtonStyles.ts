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
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-50";

const variantClasses: Record<ActionButtonVariant, string> = {
  primary:
    "bg-blue-600 text-white shadow-[0_8px_20px_rgba(37,99,235,0.22)] hover:bg-blue-500",
  addPrimary:
    "bg-green-600 text-white shadow-[0_8px_20px_rgba(22,163,74,0.18)] hover:bg-green-500",
  secondary:
    "border border-blue-500/35 bg-blue-500/10 text-blue-700 hover:border-blue-500/55 hover:bg-blue-500/20 dark:text-blue-100 dark:hover:border-blue-400/50",
  utility:
    "border border-violet-500/30 bg-violet-500/10 text-violet-700 hover:border-violet-500/50 hover:bg-violet-500/20 dark:text-violet-200 dark:hover:border-violet-400/45",
  danger:
    "border border-red-500/25 bg-red-500/[0.08] text-red-700 hover:border-red-500/40 hover:bg-red-500/15 dark:text-red-300",
  dangerStrong: "bg-red-600 text-white hover:bg-red-500",
  warningStrong: "bg-amber-500 text-gray-950 hover:bg-amber-400",
  tertiary:
    "border border-border-strong bg-control/70 text-text-secondary hover:border-border-strong hover:bg-surface-raised hover:text-text-primary",
  icon:
    "border border-border-strong bg-surface-raised/80 text-text-secondary backdrop-blur-md hover:bg-surface-muted hover:text-text-primary dark:bg-overlay/35 dark:hover:bg-overlay/50",
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

export const statusActionBaseClasses =
  "inline-flex rounded-full border px-2 py-1 text-[11px] font-medium transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-50";
