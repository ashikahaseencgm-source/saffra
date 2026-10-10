import { create } from "zustand";

interface UiState {
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  // Settings' "Replay Tour" button flips this to re-open the product tour
  // on demand, independent of the auto-shown-once-per-account logic.
  tourOpen: boolean;
  setTourOpen: (open: boolean) => void;
  // True only while the tour is actually stepping through pages — lets the
  // Sidebar stay expanded (labels visible) so the active nav item reads
  // clearly instead of a bare icon.
  tourActive: boolean;
  setTourActive: (active: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  commandPaletteOpen: false,
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  tourOpen: false,
  setTourOpen: (tourOpen) => set({ tourOpen }),
  tourActive: false,
  setTourActive: (tourActive) => set({ tourActive }),
}));
