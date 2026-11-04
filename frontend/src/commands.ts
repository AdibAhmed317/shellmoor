// Every user action lives here once. The keyboard handler, command palette, menus and the
// Keyboard settings page all read this, so they can't drift apart.
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Bookmark, Columns2, Copy, Eraser, FolderOpen, FolderPlus, History, Keyboard, LayoutTemplate,
  AppWindow, Palette, PanelLeft, Pencil, Puzzle, Sparkles, Plus, Rows2, Search, Settings, SquareTerminal, UserRound, X, XSquare,
  type LucideIcon,
} from 'lucide-react';
import { findPanel, useWorkspace } from './store/workspace';
import { useProfiles } from './store/profiles';
import { useTheme } from './store/theme';
import { openSettings, useUi } from './store/ui';
import { useSettings } from './store/settings';
import { useProjects } from './store/projects';
import { useLayouts } from './store/layouts';
import { prompt, toast } from './store/overlays';
import { enabledTools, paneTitle } from './panels/registry';
import { useExtensions } from './store/extensions';
import { openNewWindow } from './backend';
import { terminals } from './components/Terminal';
import { themes } from './themes';
import { isMac } from './ui';

export type Command = {
  id: string;
  title: string;
  group: string;
  icon?: LucideIcon;
  iconColor?: string;
  key?: string; // default KeyboardEvent.code, combined with the platform modifier; users can remap
  alt?: boolean; // uses Alt (⌘⌥ on macOS) instead, like Windows Terminal / iTerm pane navigation
  searchOnly?: boolean; // only listed once the user types
  hidden?: boolean; // keyboard only, never listed
  preview?: () => void; // run while highlighted in the palette
  run: () => void;
};

// One modifier rule per platform: ⌘ on macOS; Ctrl+Shift elsewhere so plain Ctrl keys still reach the shell.
// Alt commands avoid Ctrl+Shift+Arrow, which PowerShell and editors use for word selection.
export function matchesKey(e: KeyboardEvent, code: string, alt = false) {
  if (e.code !== code) return false;
  if (alt) return isMac ? e.metaKey && e.altKey && !e.ctrlKey && !e.shiftKey : e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey;
  if (e.altKey) return false;
  return isMac ? e.metaKey && !e.ctrlKey && !e.shiftKey : e.ctrlKey && e.shiftKey && !e.metaKey;
}

const keyNames: Record<string, string> = { BracketLeft: '[', BracketRight: ']', Comma: ',', Period: '.', Slash: '/', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Backquote: '`' };
export function keyLabel(code: string, alt = false) {
  const k = keyNames[code] ?? code.replace(/^(Key|Digit)/, '');
  if (alt) return isMac ? `⌘⌥${k}` : `Alt+${k}`;
  return isMac ? `⌘${k}` : `Ctrl+Shift+${k}`;
}

// True while Settings › Keyboard is recording a shortcut, so the global handler stands aside.
export const keyboard = { recording: false };

// The key a command currently uses: the user's remap if any, else its default.
export const keyFor = (c: Pick<Command, 'id' | 'key'>) => useSettings.getState().keymap[c.id] ?? c.key;

// Moves focus to the nearest pane in a direction, using on-screen positions.
function focusDirection(dx: number, dy: number) {
  const ws = useWorkspace.getState();
  const tab = ws.tabs.find((t) => t.id === ws.activeTabId)!;
  const panes = [...document.querySelectorAll<HTMLElement>('[data-pane-id]')].filter((el) => el.offsetWidth > 0);
  const cur = panes.find((el) => el.dataset.paneId === tab.activePanelId)?.getBoundingClientRect();
  if (!cur) return;
  const cx = cur.left + cur.width / 2;
  const cy = cur.top + cur.height / 2;
  let best: { id: string; dist: number } | null = null;
  for (const el of panes) {
    const r = el.getBoundingClientRect();
    const ahead = dx > 0 ? r.left >= cur.right - 2 : dx < 0 ? r.right <= cur.left + 2 : dy > 0 ? r.top >= cur.bottom - 2 : r.bottom <= cur.top + 2;
    if (!ahead) continue;
    const dist = Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy);
    if (!best || dist < best.dist) best = { id: el.dataset.paneId!, dist };
  }
  if (!best) return;
  ws.focusPanel(best.id);
  terminals.get(best.id)?.focus();
}

export function getCommands(): Command[] {
  const ws = useWorkspace.getState();
  const ui = useUi.getState();
  const theme = useTheme.getState();
  const { profiles, defaultId } = useProfiles.getState();
  const { projects, switchTo } = useProjects.getState();
  const tab = ws.tabs.find((t) => t.id === ws.activeTabId)!;
  const pane = findPanel(tab.root, tab.activePanelId)!;
  const term = terminals.get(pane.id);

  const tools = enabledTools();
  const extensions = useExtensions.getState().extensions.filter((x) => x.enabled);
  const withTerm = (fn: (t: NonNullable<typeof term>) => void) => () => (term ? fn(term) : toast('Focus a terminal pane first', { tone: 'warning' }));

  return [
    { id: 'new-tab', title: 'New Tab', group: 'Tabs', icon: Plus, key: 'KeyT', run: () => ws.addTab('terminal', defaultId) },
    { id: 'close-pane', title: 'Close Pane', group: 'Tabs', icon: X, key: 'KeyW', run: () => ws.closePanel(pane.id) },
    { id: 'duplicate-tab', title: 'Duplicate Tab', group: 'Tabs', icon: Copy, run: () => ws.duplicateTab(tab.id) },
    { id: 'close-other-tabs', title: 'Close Other Tabs', group: 'Tabs', icon: XSquare, run: () => ws.closeOtherTabs(tab.id) },
    { id: 'new-window', title: 'New Window', group: 'Tabs', icon: AppWindow, run: () => openNewWindow() },
    {
      id: 'move-tab-window', title: 'Move Tab to New Window', group: 'Tabs', icon: AppWindow, searchOnly: true,
      run: async () => {
        if (await openNewWindow(JSON.stringify({ tabs: [tab], activeTabId: tab.id }))) ws.closeTab(tab.id);
      },
    },
    {
      id: 'rename-tab', title: 'Rename Tab…', group: 'Tabs', icon: Pencil,
      run: async () => {
        const name = await prompt({ title: 'Rename Tab', value: tab.title ?? paneTitle(pane), confirmLabel: 'Rename' });
        if (name) ws.renameTab(tab.id, name);
      },
    },
    { id: 'next-tab', title: 'Next Tab', group: 'Tabs', icon: ArrowRight, key: 'BracketRight', run: () => ws.cycleTab(1) },
    { id: 'prev-tab', title: 'Previous Tab', group: 'Tabs', icon: ArrowLeft, key: 'BracketLeft', run: () => ws.cycleTab(-1) },
    ...ws.tabs.slice(0, 9).map((t, i) => ({
      id: `tab-${i + 1}`, title: `Go to Tab ${i + 1}`, group: 'Tabs', key: `Digit${i + 1}`, hidden: true, run: () => ws.setActiveTab(t.id),
    })),

    { id: 'split-right', title: 'Split Right', group: 'Panes', icon: Columns2, key: 'KeyD', run: () => ws.splitPanel(pane.id, 'horizontal') },
    { id: 'split-down', title: 'Split Down', group: 'Panes', icon: Rows2, key: 'KeyE', run: () => ws.splitPanel(pane.id, 'vertical') },
    { id: 'focus-left', title: 'Focus Pane Left', group: 'Panes', icon: ArrowLeft, key: 'ArrowLeft', alt: true, run: () => focusDirection(-1, 0) },
    { id: 'focus-right', title: 'Focus Pane Right', group: 'Panes', icon: ArrowRight, key: 'ArrowRight', alt: true, run: () => focusDirection(1, 0) },
    { id: 'focus-up', title: 'Focus Pane Above', group: 'Panes', icon: ArrowUp, key: 'ArrowUp', alt: true, run: () => focusDirection(0, -1) },
    { id: 'focus-down', title: 'Focus Pane Below', group: 'Panes', icon: ArrowDown, key: 'ArrowDown', alt: true, run: () => focusDirection(0, 1) },
    {
      id: 'rename-pane', title: 'Rename Pane…', group: 'Panes', icon: Pencil,
      run: async () => {
        const name = await prompt({ title: 'Rename Pane', value: paneTitle(pane), confirmLabel: 'Rename' });
        if (name) ws.renamePanel(pane.id, name);
      },
    },

    { id: 'find', title: 'Find in Terminal', group: 'Terminal', icon: Search, key: 'KeyF', run: withTerm((t) => t.find()) },
    { id: 'clear', title: 'Clear Terminal', group: 'Terminal', icon: Eraser, key: 'KeyK', run: withTerm((t) => t.clear()) },
    { id: 'history', title: 'Command History', group: 'Terminal', icon: History, key: 'KeyH', run: () => ui.open({ type: 'history' }) },
    ...profiles.map((p) => ({
      id: `terminal-${p.id}`, title: `New ${p.name} Terminal`, group: 'Terminal', icon: SquareTerminal, iconColor: p.color,
      run: () => ws.addTab('terminal', p.id),
    })),

    { id: 'switch-project', title: 'Switch Project…', group: 'Project', icon: FolderOpen, key: 'KeyO', run: () => ui.open({ type: 'projects' }) },
    { id: 'new-project', title: 'New Project…', group: 'Project', icon: FolderPlus, key: 'KeyN', run: () => ui.open({ type: 'newProject' }) },
    { id: 'layouts', title: 'Layouts…', group: 'Project', icon: LayoutTemplate, key: 'KeyL', run: () => ui.open({ type: 'layouts' }) },
    {
      id: 'save-layout', title: 'Save Current Layout…', group: 'Project', icon: Bookmark,
      run: async () => {
        const name = await prompt({ title: 'Save Layout', message: 'Saves your tabs and splits so you can restore them later.', placeholder: 'Layout name', confirmLabel: 'Save' });
        if (name) (useLayouts.getState().saveCurrent(name), toast(`Saved layout “${name}”`, { tone: 'success' }));
      },
    },
    ...projects.map((p) => ({ id: `project-${p.id}`, title: `Project: ${p.name}`, group: 'Project', icon: FolderOpen, searchOnly: true, run: () => switchTo(p.id) })),

    ...tools.map(([kind, t]) => ({ id: `open-${kind}`, title: t.label, group: 'Open', icon: t.icon, run: () => ws.openTool(kind) })),
    ...extensions.map((x) => ({ id: `open-ext-${x.id}`, title: x.name, group: 'Open', icon: Puzzle, run: () => ws.openTool('extension', { extensionId: x.id }) })),
    ...tools.map(([kind, t]) => ({
      id: `split-${kind}`, title: `Open ${t.label} in Split`, group: 'Open', icon: t.icon, searchOnly: true,
      run: () => ws.openTool(kind, { split: true }),
    })),

    { id: 'palette', title: 'Command Palette', group: 'View', key: 'KeyP', hidden: true, run: () => (ui.sheet?.type === 'palette' ? ui.close() : ui.open({ type: 'palette' })) },
    { id: 'sidebar', title: 'Toggle Sidebar', group: 'View', icon: PanelLeft, key: 'KeyB', run: ui.toggleSidebar },
    { id: 'settings', title: 'Settings', group: 'View', icon: Settings, key: 'Comma', run: () => openSettings() },
    { id: 'profiles', title: 'Edit Terminal Profiles', group: 'View', icon: UserRound, run: () => openSettings('profiles') },
    { id: 'shortcuts', title: 'Keyboard Shortcuts', group: 'View', icon: Keyboard, run: () => openSettings('shortcuts') },
    { id: 'welcome', title: 'Show Welcome', group: 'View', icon: Sparkles, run: () => ui.open({ type: 'welcome' }) },

    ...themes.map((t) => ({
      id: `theme-${t.id}`, title: `Theme: ${t.name}`, group: 'Theme', icon: Palette, iconColor: t.accent, searchOnly: true,
      preview: () => theme.setPreview(t.id),
      run: () => theme.setTheme(t.id),
    })),
  ];
}
