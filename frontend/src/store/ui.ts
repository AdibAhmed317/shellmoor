import { create } from 'zustand';
import type { DragEvent } from 'react';
import type { DragPayload } from './workspace';

export type SettingsSection = 'general' | 'appearance' | 'profiles' | 'terminal' | 'notifications' | 'security' | 'ai' | 'extensions' | 'shortcuts' | 'about';

// Which sheet/dialog is open. Only one at a time, like macOS sheets.
export type Sheet =
  | { type: 'palette' }
  | { type: 'settings'; section: SettingsSection }
  | { type: 'projects' }
  | { type: 'newProject' }
  | { type: 'layouts' }
  | { type: 'history' }
  | { type: 'host'; hostId: string | null } // null = new host
  | { type: 'welcome' }
  | null;

type UiState = {
  sidebarOpen: boolean;
  sheet: Sheet;
  drag: DragPayload | null; // what is being dragged right now (drop targets read this during dragover)
  toggleSidebar: () => void;
  open: (sheet: Exclude<Sheet, null>) => void;
  close: () => void;
};

export const useUi = create<UiState>((set) => ({
  sidebarOpen: false, // spec: context sidebar hidden by default
  sheet: null,
  drag: null,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  open: (sheet) => set({ sheet }),
  close: () => set({ sheet: null }),
}));

export const openSettings = (section: SettingsSection = 'general') => useUi.getState().open({ type: 'settings', section });

// Spread onto anything draggable: <div {...dragSource({ type: 'tab', tabId })}>
export const dragSource = (payload: DragPayload) => ({
  draggable: true,
  onDragStart: (e: DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', ''); // some engines won't start a drag without data
    useUi.setState({ drag: payload });
  },
  onDragEnd: () => useUi.setState({ drag: null }),
});

// Drop handlers call this too: the source may unmount on drop and never fire dragend.
export const endDrag = () => useUi.setState({ drag: null });
