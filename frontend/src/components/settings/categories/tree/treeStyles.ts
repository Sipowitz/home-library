export function getDepthStyles(depth: number) {
  switch (depth) {
    // ROOT
    case 0:
      return {
        bg: `
          bg-gradient-to-b
          from-fuchsia-500/10
          to-surface
          dark:from-fuchsia-500/25
          dark:to-purple-900/90
        `,

        border: `
          border-fuchsia-500/35
          dark:border-fuchsia-400/50
        `,

        glow: `
          shadow-[0_0_40px_rgba(217,70,239,0.18)]
        `,
      };

    // LEVEL 1
    case 1:
      return {
        bg: `
          bg-gradient-to-b
          from-blue-500/10
          to-surface
          dark:from-blue-500/20
          dark:to-slate-900/95
        `,

        border: `
          border-blue-500/35
          dark:border-blue-400/40
        `,

        glow: `
          shadow-[0_0_30px_rgba(59,130,246,0.14)]
        `,
      };

    // LEVEL 2
    case 2:
      return {
        bg: `
          bg-gradient-to-b
          from-emerald-500/10
          to-surface
          dark:from-emerald-500/18
          dark:to-slate-900/95
        `,

        border: `
          border-emerald-500/30
          dark:border-emerald-400/35
        `,

        glow: `
          shadow-[0_0_28px_rgba(16,185,129,0.12)]
        `,
      };

    // DEEP
    default:
      return {
        bg: `
          bg-gradient-to-b
          from-slate-500/5
          to-surface
          dark:from-gray-700/30
          dark:to-slate-950/95
        `,

        border: `
          border-border-strong
          dark:border-gray-500/30
        `,

        glow: `
          shadow-[0_0_20px_rgba(255,255,255,0.05)]
        `,
      };
  }
}
