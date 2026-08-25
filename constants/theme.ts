// Тема AdminBMG «Жидкий металл»: тёмный графит + расплавленное серебро —
// поверхности с металлическим переливом и глянцевыми бликами.
// Фирменный оранжевый BOOOMERANGS — единственный цветовой акцент (CTA).
export const colors = {
  bg: "#0a0a0c",
  surface: "#17181d",
  surfaceAlt: "#22242b",
  border: "#4a4f5a",
  text: "#f2f4f8",
  textMuted: "#9ba1ac",

  // Акценты
  accent: "#ff5a1f", // фирменный оранжевый — основной CTA
  accentSoft: "#2a1610",
  accent2: "#c9ced8", // серебро — ИИ-блоки, hero

  // Градиенты (стоп-цвета для LinearGradient)
  gradPrimary: ["#ff7a3d", "#ff5a1f"] as const, // оранжевое пламя
  gradCosmic: ["#5a606c", "#191b21"] as const, // расплавленное серебро (hero)
  gradCard: ["#2c2f37", "#16171c"] as const, // жидкий металл (карточки)
  gradAi: ["#eceef3", "#9aa1ae"] as const, // хром

  glowAccent: "rgba(255,90,31,0.35)",
  glowViolet: "rgba(220,228,242,0.40)", // серебристое свечение расплава

  danger: "#ff5470",
  success: "#34e5a1",
  warning: "#ffb648",
  info: "#53c8ff",
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
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
} as const;

export const font = {
  regular: "System",
  medium: "System",
  bold: "System",
} as const;
