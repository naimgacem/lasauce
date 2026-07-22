"use client";

import { useQuery } from "@tanstack/react-query";

import { categoryKeys } from "@/lib/query-keys";
import { api } from "@/services";
import type { Category } from "@/types/category";

export function useCategories() {
  return useQuery({
    queryKey: categoryKeys.tree(),
    queryFn: () => api.categories.tree(),
    staleTime: 10 * 60_000, // near-static
  });
}

export interface FlatCategory {
  id: string;
  name: string;
  depth: number;
}

/** Depth-first flatten for `<Select>` options, preserving hierarchy. */
export function flattenCategories(
  categories: Category[] = [],
  depth = 0,
): FlatCategory[] {
  return categories.flatMap((category) => [
    { id: category.id, name: category.name, depth },
    ...flattenCategories(category.children, depth + 1),
  ]);
}
