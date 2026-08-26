import type { Ionicons } from "@expo/vector-icons";

export interface AdminSection {
  key: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  badge?: string;
}

export const ADMIN_SECTIONS: AdminSection[] = [
  { key: "products", title: "Товары", description: "Каталог, цены, фото, бейджи", icon: "shirt-outline", route: "/products" },
  { key: "orders", title: "Заказы", description: "Розница, опт, черновики, самовывоз", icon: "receipt-outline", route: "/orders" },
  { key: "clients", title: "Клиенты", description: "Розничные и оптовые клиенты", icon: "people-outline", route: "/clients" },
  { key: "wholesale", title: "Оптовики", description: "Одобрение, скидки, предзаказы", icon: "business-outline", route: "/wholesale" },
  { key: "problems", title: "Проблемные", description: "Скрытые, без фото, нулевая цена", icon: "warning-outline", route: "/problems" },
  { key: "bonuses", title: "Бонусы", description: "Промокоды, сертификаты, рассылки", icon: "gift-outline", route: "/bonuses" },
  { key: "reviews", title: "Отзывы", description: "Модерация отзывов", icon: "star-outline", route: "/reviews" },
  { key: "favorites", title: "Избранное", description: "Избранное клиентов", icon: "heart-outline", route: "/favorites" },
  { key: "preorders", title: "Предзаказы", description: "Кампании, заказы, точки выдачи", icon: "calendar-outline", route: "/preorders" },
  { key: "pages", title: "Страницы", description: "Конструктор главной, блог, FAQ", icon: "albums-outline", route: "/pages" },
  { key: "partners", title: "Партнёры", description: "Партнёрская программа и выплаты", icon: "ribbon-outline", route: "/partners" },
  { key: "analytics", title: "Аналитика", description: "Заказы и статистика артистов", icon: "bar-chart-outline", route: "/analytics" },
  { key: "ai", title: "AI-чат", description: "Агент BOOOM AI и база знаний", icon: "chatbubbles-outline", route: "/ai" },
  { key: "ai-questions", title: "AI-вопросы", description: "Библиотека вопросов", icon: "help-circle-outline", route: "/ai-questions" },
  { key: "seo", title: "SEO", description: "Настройки страниц, аудит", icon: "search-outline", route: "/seo" },
  { key: "security", title: "Безопасность", description: "Меры защиты и лимиты", icon: "shield-checkmark-outline", route: "/security" },
  { key: "diagnostics", title: "Диагностика", description: "Статус сервера и API, журнал событий", icon: "pulse-outline", route: "/diagnostics" },
  { key: "integrations", title: "Интеграции", description: "1С, Ozon, push, примерка", icon: "extension-puzzle-outline", route: "/integrations" },
];
