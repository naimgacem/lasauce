import { request } from "@/services/http/client";
import type { CategoriesApi } from "@/services/contracts";
import type { Category } from "@/types/category";

export const categoriesClient: CategoriesApi = {
  tree: () => request<Category[]>("/categories"),
};
