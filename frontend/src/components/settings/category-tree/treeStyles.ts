export function getDepthStyles(depth: number) {
  if (depth === 0) {
    return {
      border: "border-purple-500/50",

      bg: `
        from-purple-900/40
        via-slate-950/80
        to-black/80
      `,

      edge: "#a855f7",
    };
  }

  if (depth === 1) {
    return {
      border: "border-blue-500/40",

      bg: `
        from-blue-900/30
        via-slate-950/80
        to-black/80
      `,

      edge: "#3b82f6",
    };
  }

  if (depth === 2) {
    return {
      border: "border-emerald-500/40",

      bg: `
        from-emerald-900/30
        via-slate-950/80
        to-black/80
      `,

      edge: "#10b981",
    };
  }

  return {
    border: "border-gray-700",

    bg: `
      from-gray-800/40
      via-slate-950/80
      to-black/80
    `,

    edge: "#6b7280",
  };
}
