import type { Ionicons } from "@expo/vector-icons";

// Соответствие имён иконок, которые хранит бэкенд (из lucide-набора сайта),
// глифам Ionicons в мобильном приложении.
const MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  Shirt: "shirt-outline",
  Flag: "flag-outline",
  Palette: "color-palette-outline",
  Layers: "layers-outline",
  Sprout: "leaf-outline",
  ShieldCheck: "shield-checkmark-outline",
  Droplets: "water-outline",
  Award: "ribbon-outline",
  Gem: "diamond-outline",
  Feather: "leaf-outline",
  Ruler: "resize-outline",
  Leaf: "leaf-outline",
  Heart: "heart-outline",
  Star: "star-outline",
  Sparkles: "sparkles-outline",
  PackageCheck: "cube-outline",
  Recycle: "refresh-circle-outline",
  Sun: "sunny-outline",
  Snowflake: "snow-outline",
  Zap: "flash-outline",
  Hand: "hand-left-outline",
  Gauge: "speedometer-outline",
};

export const FEATURE_BADGE_ICON_OPTIONS: Array<{
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { name: "Shirt", label: "Ткань / одежда", icon: "shirt-outline" },
  { name: "Flag", label: "Страна / флаг", icon: "flag-outline" },
  { name: "Palette", label: "Принт / дизайн", icon: "color-palette-outline" },
  { name: "Layers", label: "Плотность / слои", icon: "layers-outline" },
  { name: "Sprout", label: "Натуральность", icon: "leaf-outline" },
  { name: "ShieldCheck", label: "Качество / гарантия", icon: "shield-checkmark-outline" },
  { name: "Droplets", label: "Уход / стирка", icon: "water-outline" },
  { name: "Award", label: "Награда / премиум", icon: "ribbon-outline" },
  { name: "Gem", label: "Премиум", icon: "diamond-outline" },
  { name: "Feather", label: "Лёгкость / мягкость", icon: "leaf-outline" },
  { name: "Ruler", label: "Размер / посадка", icon: "resize-outline" },
  { name: "Leaf", label: "Эко", icon: "leaf-outline" },
  { name: "Heart", label: "Забота / комфорт", icon: "heart-outline" },
  { name: "Star", label: "Отличие", icon: "star-outline" },
  { name: "Sparkles", label: "Особенность", icon: "sparkles-outline" },
  { name: "PackageCheck", label: "Упаковка / доставка", icon: "cube-outline" },
  { name: "Recycle", label: "Переработка", icon: "refresh-circle-outline" },
  { name: "Sun", label: "Лето / жара", icon: "sunny-outline" },
  { name: "Snowflake", label: "Зима / холод", icon: "snow-outline" },
  { name: "Zap", label: "Прочность", icon: "flash-outline" },
  { name: "Hand", label: "Ручная работа", icon: "hand-left-outline" },
  { name: "Gauge", label: "Плотность (г/м²)", icon: "speedometer-outline" },
];

export function featureBadgeIcon(name: string | undefined | null): keyof typeof Ionicons.glyphMap {
  return (name && MAP[name]) || "sparkles-outline";
}
