// App-wide transient UI: context menus, dialogs (confirm/prompt) and toasts.
// Call the helpers from anywhere; <Overlays /> renders them.
import { create } from 'zustand';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { Tone } from '../ui';

export type MenuItem =
  | { label: string; icon?: LucideIcon; shortcut?: string; danger?: boolean; disabled?: boolean; onSelect: () => void }
  | 'separator';

type Dialog =
  | { kind: 'confirm'; title: string; message?: string; confirmLabel: string; destructive?: boolean; resolve: (ok: boolean) => void }
  | { kind: 'prompt'; title: string; message?: string; value: string; placeholder?: string; confirmLabel: string; resolve: (value: string | null) => void };

export type Toast = { id: number; message: string; description?: string; tone: Tone; action?: { label: string; run: () => void } };

type OverlayState = {
  menu: { x: number; y: number; items: MenuItem[] } | null;
  dialog: Dialog | null;
  toasts: Toast[];
};

export const useOverlays = create<OverlayState>(() => ({ menu: null, dialog: null, toasts: [] }));

export function contextMenu(e: ReactMouseEvent | MouseEvent, items: MenuItem[]) {
  e.preventDefault();
  e.stopPropagation();
  useOverlays.setState({ menu: { x: e.clientX, y: e.clientY, items } });
}

export const closeMenu = () => useOverlays.setState({ menu: null });

export function confirm(opts: { title: string; message?: string; confirmLabel?: string; destructive?: boolean }) {
  return new Promise<boolean>((resolve) =>
    useOverlays.setState({ dialog: { kind: 'confirm', confirmLabel: 'OK', ...opts, resolve } }),
  );
}

export function prompt(opts: { title: string; message?: string; value?: string; placeholder?: string; confirmLabel?: string }) {
  return new Promise<string | null>((resolve) =>
    useOverlays.setState({ dialog: { kind: 'prompt', value: '', confirmLabel: 'OK', ...opts, resolve } }),
  );
}

let nextToast = 1;
export function toast(message: string, opts: { description?: string; tone?: Tone; action?: Toast['action']; duration?: number } = {}) {
  const id = nextToast++;
  useOverlays.setState((s) => ({ toasts: [...s.toasts.slice(-3), { id, message, tone: opts.tone ?? 'neutral', description: opts.description, action: opts.action }] }));
  setTimeout(() => dismissToast(id), opts.duration ?? 4000);
}

export const dismissToast = (id: number) => useOverlays.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
