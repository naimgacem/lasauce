import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { ItemType } from "@/types/item";

/** Autosaved report-wizard draft — a refresh never loses a half-written report. */
export interface ReportDraft {
  type: ItemType;
  step: number;
  title?: string;
  description?: string;
  category_id?: string;
  color?: string;
  brand?: string;
  /** Algerian wilaya code (1–58). */
  wilaya_code?: number;
  location_text?: string;
  lost_or_found_at?: string;
  /** Verification question asked before contact details are exchanged. */
  claim_question?: string;
}

interface DraftState {
  draft: ReportDraft | null;
  saveDraft: (draft: ReportDraft) => void;
  clearDraft: () => void;
}

export const useDraftStore = create<DraftState>()(
  persist(
    (set) => ({
      draft: null,
      saveDraft: (draft) => set({ draft }),
      clearDraft: () => set({ draft: null }),
    }),
    {
      name: "lostfound-report-draft",
      storage: createJSONStorage(() => window.localStorage),
      skipHydration: true,
    },
  ),
);
