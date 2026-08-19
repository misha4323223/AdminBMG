// Тёмная тема в стиле BOOOMERANGS (чёрный + оранжевый акцент).
export const colors = {
  bg: "#0b0b0f",
  surface: "#141419",
  surfaceAlt: "#1c1c23",
  border: "#2a2a33",
  text: "#f4f4f5",
  textMuted: "#9a9aa3",
  accent: "#ff5a1f",
  accentSoft: "#2a1610",
  danger: "#ef4444",
  success: "#22c55e",
  warning: "#f59e0b",
  info: "#38bdf8",
  white: "#ffffff",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const font = {
  regular: "System",
  medium: "System",
  bold: "System",
} as const;
