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

export function useCategories(): { categories: CategoriesMap; loading: boolean } {
  const [categories, setCategories] = useState<CategoriesMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet<{ categories?: CategoriesMap }>("/admin/categories");
        setCategories(data?.categories || {});
      } catch {
        setCategories({});
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { categories, loading };
}

export function subcategoriesFor(
  categories: CategoriesMap,
  categorySlug: string,
): SubcategoryConfig[] {
  return categories[categorySlug]?.subcategories || [];
}

export function subSubsFor(
  categories: CategoriesMap,
  categorySlug: string,
  subcategoryName: string,
): SubSubcategoryConfig[] {
  const sub = subcategoriesFor(categories, categorySlug).find(
    (s) => s.name === subcategoryName,
  );
  return sub?.subSubcategories || [];
}
