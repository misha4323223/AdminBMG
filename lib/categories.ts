import { useEffect, useState } from "react";
import { apiGet } from "./api";

export interface SubSubcategoryConfig {
  name: string;
  slug: string;
}

export interface SubcategoryConfig {
  name: string;
  slug: string;
  subSubcategories?: SubSubcategoryConfig[];
}

export interface CategoryConfig {
  name: string;
  slug: string;
  subcategories: SubcategoryConfig[];
}

export type CategoriesMap = Record<string, CategoryConfig>;

const sub = (name: string, slug = ""): SubcategoryConfig => ({
  name,
  slug: slug || name.toLowerCase().replace(/[^a-zа-я0-9]+/gi, "-"),
});

/** Статичный набор категорий — запасной вариант, когда серверный конфиг недоступен. */
export const DEFAULT_CATEGORIES: CategoriesMap = {
  clothing: {
    name: "Одежда",
    slug: "clothing",
    subcategories: [
      sub("Толстовки"),
      sub("Свитшоты"),
      sub("Свитера"),
      sub("Шорты"),
      sub("Футболки"),
      sub("Куртки"),
      sub("Брюки"),
    ],
  },
  socks: {
    name: "Носки",
    slug: "socks",
    subcategories: [
      sub("Классические (40-45)", "klassicheskie-40-45"),
      sub("Классические (34-39)", "klassicheskie-34-39"),
      sub("Спортивные (40-45)", "sportivnye-40-45"),
      sub("Спортивные (34-39)", "sportivnye-34-39"),
      sub("Короткие (40-45)", "korotkie-40-45"),
      sub("Короткие (34-39)", "korotkie-34-39"),
      sub("Детские"),
      sub("Подарочные наборы"),
    ],
  },
  accessories: {
    name: "Аксессуары",
    slug: "accessories",
    subcategories: [sub("Кружки"), sub("Ремни"), sub("Сумки"), sub("Шапки")],
  },
  merch: {
    name: "Мерч",
    slug: "merch",
    subcategories: [
      sub("formula", "formula"),
      sub("JDM", "jdm"),
      sub("ГУДТАЙМС", "gudtajms"),
      sub("ДИКАЯ МЯТА", "dikaya-myata"),
      sub("Драгни", "dragni"),
      sub("Мультфильмы", "multfilmy"),
      sub("Тульские Дизайнеры", "tulskie-dizajnery"),
    ],
  },
  sale: {
    name: "Распродажа",
    slug: "sale",
    subcategories: [],
  },
};

function normalizeCategories(raw: unknown): CategoriesMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: CategoriesMap = {};

  for (const [key, rawCategory] of Object.entries(raw as Record<string, unknown>)) {
    if (!rawCategory || typeof rawCategory !== "object") continue;
    const category = rawCategory as Record<string, unknown>;
    const slug = String(category.slug || key).trim();
    const name = String(category.name || key).trim();
    if (!slug || !name) continue;

    const rawSubs = Array.isArray(category.subcategories) ? category.subcategories : [];
    const subcategories: SubcategoryConfig[] = [];
    for (const rawSub of rawSubs) {
      const subValue = typeof rawSub === "string" ? { name: rawSub } : rawSub;
      if (!subValue || typeof subValue !== "object") continue;
      const subRecord = subValue as Record<string, unknown>;
      const subName = String(subRecord.name || subRecord.slug || "").trim();
      if (!subName) continue;

      const rawSubSubs = Array.isArray(subRecord.subSubcategories)
        ? subRecord.subSubcategories
        : [];
      const subSubcategories = rawSubSubs
        .map((rawSubSub) => {
          const value = typeof rawSubSub === "string" ? { name: rawSubSub } : rawSubSub;
          if (!value || typeof value !== "object") return null;
          const record = value as Record<string, unknown>;
          const subSubName = String(record.name || record.slug || "").trim();
          return subSubName
            ? { name: subSubName, slug: String(record.slug || subSubName) }
            : null;
        })
        .filter((value): value is SubSubcategoryConfig => value !== null);

      subcategories.push({
        name: subName,
        slug: String(subRecord.slug || subName),
        ...(subSubcategories.length > 0 ? { subSubcategories } : {}),
      });
    }

    result[slug] = { name, slug, subcategories };
  }
  return result;
}

/**
 * Объединяет серверный конфиг с локальными названиями каталога.
 * Старый API иногда возвращает ключи clothing/accessories вместо русских
 * названий — в интерфейсе админки известные разделы всегда должны оставаться
 * понятными, а новые серверные категории при этом не теряются.
 */
function mergeConfiguredCategories(server: CategoriesMap): CategoriesMap {
  const result: CategoriesMap = {};
  const slugs = new Set([...Object.keys(DEFAULT_CATEGORIES), ...Object.keys(server)]);

  for (const slug of slugs) {
    const fallback = DEFAULT_CATEGORIES[slug];
    const remote = server[slug];
    if (!remote && fallback) {
      result[slug] = fallback;
      continue;
    }
    if (!remote) continue;

    const fallbackSubs = fallback?.subcategories || [];
    const remoteSubs = remote.subcategories || [];
    const subByKey = new Map<string, SubcategoryConfig>();
    for (const item of [...fallbackSubs, ...remoteSubs]) {
      const key = `${item.slug}|${item.name.trim().toLowerCase()}`;
      const previous = subByKey.get(key);
      if (!previous) {
        subByKey.set(key, { ...item, subSubcategories: item.subSubcategories?.map((s) => ({ ...s })) });
      } else if (item.subSubcategories?.length) {
        const subSub = new Map(
          [...(previous.subSubcategories || []), ...item.subSubcategories].map((s) => [s.name.toLowerCase(), s]),
        );
        previous.subSubcategories = Array.from(subSub.values());
      }
    }

    result[slug] = {
      ...remote,
      // Для известных разделов локальная русская подпись важнее legacy slug.
      name: fallback?.name || remote.name,
      subcategories: Array.from(subByKey.values()),
    };
  }
  return result;
}

export function useCategories(): { categories: CategoriesMap; loading: boolean } {
  const [categories, setCategories] = useState<CategoriesMap>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await apiGet<{ categories?: unknown }>("/admin/categories");
        const server = normalizeCategories(data?.categories);
        if (alive && Object.keys(server).length > 0) {
          setCategories(mergeConfiguredCategories(server));
        }
      } catch {
        // оставляем статичный набор
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { categories, loading };
}

export function subcategoriesFor(
  categories: CategoriesMap,
  categorySlug: string,
): SubcategoryConfig[] {
  const category = categories[categorySlug];
  return Array.isArray(category?.subcategories) ? category.subcategories : [];
}

export function subSubsFor(
  categories: CategoriesMap,
  categorySlug: string,
  subcategoryName: string,
): SubSubcategoryConfig[] {
  const wanted = String(subcategoryName || "").trim().toLowerCase();
  const subcategory = subcategoriesFor(categories, categorySlug).find(
    (item) =>
      item.name.trim().toLowerCase() === wanted ||
      item.slug.trim().toLowerCase() === wanted,
  );
  return subcategory?.subSubcategories || [];
}

/**
 * Слияние конфига категорий с реальными данными товаров.
 * Так в селекторах не теряются legacy-пути, которых ещё нет в конфиге сайта.
 */
export function mergeCategoriesWithProducts(
  categories: CategoriesMap,
  products: Array<{
    category?: unknown;
    subcategory?: unknown;
    subSubcategory?: unknown;
    additionalCategories?: Array<{
      category?: unknown;
      subcategory?: unknown;
      subSubcategory?: unknown;
    }>;
  }>,
): CategoriesMap {
  const normalized = normalizeCategories(categories);
  const merged: CategoriesMap = {};

  for (const [slug, cat] of Object.entries(normalized)) {
    merged[slug] = {
      name: cat.name,
      slug: cat.slug || slug,
      subcategories: (cat.subcategories || []).map((item) => ({
        name: item.name,
        slug: item.slug || item.name,
        ...(item.subSubcategories
          ? { subSubcategories: item.subSubcategories.map((subSub) => ({ ...subSub })) }
          : {}),
      })),
    };
  }

  const ensure = (slugValue?: unknown, subName?: unknown, subSubName?: unknown) => {
    const slug = String(slugValue || "").trim();
    if (!slug) return;
    if (!merged[slug]) merged[slug] = { name: slug, slug, subcategories: [] };

    const subValue = String(subName || "").trim();
    if (!subValue) return;
    let subcategory = merged[slug].subcategories.find(
      (item) => item.name.trim().toLowerCase() === subValue.toLowerCase(),
    );
    if (!subcategory) {
      subcategory = { name: subValue, slug: subValue };
      merged[slug].subcategories.push(subcategory);
    }

    const subSubValue = String(subSubName || "").trim();
    if (!subSubValue) return;
    const current = subcategory.subSubcategories || [];
    if (!current.some((item) => item.name.trim().toLowerCase() === subSubValue.toLowerCase())) {
      subcategory.subSubcategories = [
        ...current,
        { name: subSubValue, slug: subSubValue },
      ];
    }
  };

  for (const product of products) {
    ensure(product.category, product.subcategory, product.subSubcategory);
    for (const additional of Array.isArray(product.additionalCategories)
      ? product.additionalCategories
      : []) {
      ensure(additional?.category, additional?.subcategory, additional?.subSubcategory);
    }
  }

  return merged;
}
