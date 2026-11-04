// Named layouts: built-in templates plus layouts the user saved. Applying one replaces the current tabs.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { cloneSnapshot, firstPanelId, newPanel, useWorkspace, type Direction, type LayoutNode, type PanelKind, type Snapshot, type Tab } from './workspace';

export type Layout = { id: string; name: string; description: string; builtIn?: boolean; snapshot: Snapshot };

// Tiny builders for the templates below.
const p = (kind: PanelKind): LayoutNode => newPanel(kind);
const split = (direction: Direction, ...children: LayoutNode[]): LayoutNode => ({ type: 'split', id: crypto.randomUUID(), direction, children });
const row = (...c: LayoutNode[]) => split('horizontal', ...c);
const col = (...c: LayoutNode[]) => split('vertical', ...c);
const tab = (root: LayoutNode): Tab => ({ id: crypto.randomUUID(), root, activePanelId: firstPanelId(root) });
const snap = (...tabs: Tab[]): Snapshot => ({ tabs, activeTabId: tabs[0].id });

export const builtInLayouts: Layout[] = [
  { id: 'blank', name: 'Terminal', description: 'A single terminal', builtIn: true, snapshot: snap(tab(p('terminal'))) },
  { id: 'web', name: 'Web Development', description: 'Editor, terminal and live preview', builtIn: true, snapshot: snap(tab(row(p('editor'), col(p('terminal'), p('browser'))))) },
  { id: 'backend', name: 'Backend', description: 'Editor beside two terminals, plus Git', builtIn: true, snapshot: snap(tab(row(p('editor'), col(p('terminal'), p('terminal')))), tab(p('git'))) },
  { id: 'devops', name: 'DevOps', description: 'Containers, cluster and activity', builtIn: true, snapshot: snap(tab(row(p('docker'), col(p('kubernetes'), p('monitor'))))) },
  { id: 'remote', name: 'Remote Ops', description: 'Hosts, a terminal and server activity', builtIn: true, snapshot: snap(tab(row(p('ssh'), col(p('terminal'), p('monitor'))))) },
];

type LayoutsState = {
  saved: Layout[];
  saveCurrent: (name: string) => void;
  remove: (id: string) => void;
};

export const useLayouts = create<LayoutsState>()(
  persist(
    (set) => ({
      saved: [],
      saveCurrent: (name) => {
        const { tabs, activeTabId } = useWorkspace.getState();
        const count = tabs.length;
        const layout: Layout = { id: crypto.randomUUID(), name, description: `${count} tab${count > 1 ? 's' : ''}, saved ${new Date().toLocaleDateString()}`, snapshot: cloneSnapshot({ tabs, activeTabId }) };
        set((s) => ({ saved: [...s.saved, layout] }));
      },
      remove: (id) => set((s) => ({ saved: s.saved.filter((l) => l.id !== id) })),
    }),
    { name: 'shellmoor-layouts' },
  ),
);

export const applyLayout = (layout: Layout) => useWorkspace.getState().load(layout.snapshot);
