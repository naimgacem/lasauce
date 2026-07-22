export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
}

/** Category node from `GET /categories` (nested tree). */
export interface Category extends CategorySummary {
  parent_id: string | null;
  children: Category[];
}
