import { create } from "zustand";

/** Ephemeral chrome state — never persisted. */
interface UiState {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  mobileMenuOpen: false,
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
}));
