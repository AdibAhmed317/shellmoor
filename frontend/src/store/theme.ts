import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { applyTheme, themeById, themes, type Theme } from '../themes';

type ThemeState = {
  themeId: string;
  previewId: string | null; // hovered in the picker, not saved
  setTheme: (id: string) => void;
  setPreview: (id: string | null) => void;
  cycle: (step: number) => void;
};

export const useTheme = create<ThemeState>()(
  persist(
    (set, get) => ({
      themeId: 'shellmoor',
      previewId: null,
      setTheme: (themeId) => set({ themeId, previewId: null }),
      setPreview: (previewId) => set({ previewId }),
      cycle: (step) => {
        const i = themes.findIndex((t) => t.id === get().themeId);
        set({ themeId: themes[(i + step + themes.length) % themes.length].id, previewId: null });
      },
    }),
    { name: 'shellmoor-theme', partialize: (s) => ({ themeId: s.themeId }) },
  ),
);

export const activeTheme = (s: Pick<ThemeState, 'themeId' | 'previewId'>): Theme => themeById(s.previewId ?? s.themeId);

applyTheme(activeTheme(useTheme.getState()));
useTheme.subscribe((s) => applyTheme(activeTheme(s)));
