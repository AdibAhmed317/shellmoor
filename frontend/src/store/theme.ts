import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { applyTheme, themeById, type Theme } from '../themes';

type ThemeState = {
  themeId: string;
  previewId: string | null; // hovered in settings or highlighted in the palette, not saved
  setTheme: (id: string) => void;
  setPreview: (id: string | null) => void;
};

export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      themeId: 'shellmoor',
      previewId: null,
      setTheme: (themeId) => set({ themeId, previewId: null }),
      setPreview: (previewId) => set({ previewId }),
    }),
    { name: 'shellmoor-theme', partialize: (s) => ({ themeId: s.themeId }) },
  ),
);

export const activeTheme = (s: Pick<ThemeState, 'themeId' | 'previewId'>): Theme => themeById(s.previewId ?? s.themeId);

applyTheme(activeTheme(useTheme.getState()));
useTheme.subscribe((s) => applyTheme(activeTheme(s)));
