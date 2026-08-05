/**
 * Algeria's 58 wilayas, keyed by official administrative code.
 *
 * Items store the CODE, never the name, so the same record renders in Arabic,
 * French or English with no data migration.
 *
 * French and English names are identical for almost every wilaya (both use the
 * romanised form), so they share one column; Arabic is the official spelling.
 * Mirrors `backend/app/core/wilayas.py` — static reference data is duplicated on
 * purpose so selects render with no round-trip; the API still validates codes.
 */

export interface Wilaya {
  /** Official administrative number, 1–58. */
  code: number;
  /** Romanised name, used for `fr` and `en`. */
  name: string;
  /** Official Arabic name. */
  nameAr: string;
}

export const ALGERIA_WILAYAS: readonly Wilaya[] = [
  { code: 1, name: "Adrar", nameAr: "أدرار" },
  { code: 2, name: "Chlef", nameAr: "الشلف" },
  { code: 3, name: "Laghouat", nameAr: "الأغواط" },
  { code: 4, name: "Oum El Bouaghi", nameAr: "أم البواقي" },
  { code: 5, name: "Batna", nameAr: "باتنة" },
  { code: 6, name: "Béjaïa", nameAr: "بجاية" },
  { code: 7, name: "Biskra", nameAr: "بسكرة" },
  { code: 8, name: "Béchar", nameAr: "بشار" },
  { code: 9, name: "Blida", nameAr: "البليدة" },
  { code: 10, name: "Bouira", nameAr: "البويرة" },
  { code: 11, name: "Tamanrasset", nameAr: "تمنراست" },
  { code: 12, name: "Tébessa", nameAr: "تبسة" },
  { code: 13, name: "Tlemcen", nameAr: "تلمسان" },
  { code: 14, name: "Tiaret", nameAr: "تيارت" },
  { code: 15, name: "Tizi Ouzou", nameAr: "تيزي وزو" },
  { code: 16, name: "Alger", nameAr: "الجزائر" },
  { code: 17, name: "Djelfa", nameAr: "الجلفة" },
  { code: 18, name: "Jijel", nameAr: "جيجل" },
  { code: 19, name: "Sétif", nameAr: "سطيف" },
  { code: 20, name: "Saïda", nameAr: "سعيدة" },
  { code: 21, name: "Skikda", nameAr: "سكيكدة" },
  { code: 22, name: "Sidi Bel Abbès", nameAr: "سيدي بلعباس" },
  { code: 23, name: "Annaba", nameAr: "عنابة" },
  { code: 24, name: "Guelma", nameAr: "قالمة" },
  { code: 25, name: "Constantine", nameAr: "قسنطينة" },
  { code: 26, name: "Médéa", nameAr: "المدية" },
  { code: 27, name: "Mostaganem", nameAr: "مستغانم" },
  { code: 28, name: "M'Sila", nameAr: "المسيلة" },
  { code: 29, name: "Mascara", nameAr: "معسكر" },
  { code: 30, name: "Ouargla", nameAr: "ورقلة" },
  { code: 31, name: "Oran", nameAr: "وهران" },
  { code: 32, name: "El Bayadh", nameAr: "البيض" },
  { code: 33, name: "Illizi", nameAr: "إليزي" },
  { code: 34, name: "Bordj Bou Arréridj", nameAr: "برج بوعريريج" },
  { code: 35, name: "Boumerdès", nameAr: "بومرداس" },
  { code: 36, name: "El Tarf", nameAr: "الطارف" },
  { code: 37, name: "Tindouf", nameAr: "تندوف" },
  { code: 38, name: "Tissemsilt", nameAr: "تيسمسيلت" },
  { code: 39, name: "El Oued", nameAr: "الوادي" },
  { code: 40, name: "Khenchela", nameAr: "خنشلة" },
  { code: 41, name: "Souk Ahras", nameAr: "سوق أهراس" },
  { code: 42, name: "Tipaza", nameAr: "تيبازة" },
  { code: 43, name: "Mila", nameAr: "ميلة" },
  { code: 44, name: "Aïn Defla", nameAr: "عين الدفلى" },
  { code: 45, name: "Naâma", nameAr: "النعامة" },
  { code: 46, name: "Aïn Témouchent", nameAr: "عين تموشنت" },
  { code: 47, name: "Ghardaïa", nameAr: "غرداية" },
  { code: 48, name: "Relizane", nameAr: "غليزان" },
  // --- created by the 2019 administrative reform ---
  { code: 49, name: "Timimoun", nameAr: "تيميمون" },
  { code: 50, name: "Bordj Badji Mokhtar", nameAr: "برج باجي مختار" },
  { code: 51, name: "Ouled Djellal", nameAr: "أولاد جلال" },
  { code: 52, name: "Béni Abbès", nameAr: "بني عباس" },
  { code: 53, name: "In Salah", nameAr: "عين صالح" },
  { code: 54, name: "In Guezzam", nameAr: "عين قزام" },
  { code: 55, name: "Touggourt", nameAr: "تقرت" },
  { code: 56, name: "Djanet", nameAr: "جانت" },
  { code: 57, name: "El M'Ghair", nameAr: "المغير" },
  { code: 58, name: "El Meniaa", nameAr: "المنيعة" },
] as const;

export const WILAYA_CODE_MIN = 1;
export const WILAYA_CODE_MAX = 58;

const BY_CODE = new Map(ALGERIA_WILAYAS.map((w) => [w.code, w]));

/** Localised wilaya list, ready for a select. Arabic sorts by Arabic name. */
export function wilayasFor(locale: string): { code: number; name: string }[] {
  const ar = locale === "ar";
  const list = ALGERIA_WILAYAS.map((w) => ({
    code: w.code,
    name: ar ? w.nameAr : w.name,
  }));
  return ar
    ? list.sort((a, b) => a.name.localeCompare(b.name, "ar"))
    : list;
}

/** Display name for a stored wilaya code, or null when unset/unknown. */
export function wilayaName(
  code: number | null | undefined,
  locale = "fr",
): string | null {
  if (code == null) return null;
  const wilaya = BY_CODE.get(code);
  if (!wilaya) return null;
  return locale === "ar" ? wilaya.nameAr : wilaya.name;
}

/**
 * Compact one-line location for cards and rows — "Oran — near the main gate",
 * degrading to whichever part exists.
 */
export function formatLocation(
  code: number | null | undefined,
  locationText: string | null | undefined,
  locale = "fr",
): string | null {
  const wilaya = wilayaName(code, locale);
  const detail = locationText?.trim() || null;
  if (wilaya && detail) return `${wilaya} — ${detail}`;
  return wilaya ?? detail;
}
