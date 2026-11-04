import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PanelKind = 'terminal' | 'editor' | 'browser' | 'git' | 'ssh' | 'docker' | 'kubernetes' | 'monitor' | 'tasks' | 'ai' | 'extension';
export type Direction = 'horizontal' | 'vertical';

// profileId: terminals only. title: user rename; otherwise derived from the kind/profile.
export type PanelNode = { type: 'panel'; id: string; kind: PanelKind; profileId?: string; extensionId?: string; title?: string }; // extensionId: extension panes only
// A tab's layout is a tree: leaves are panels, inner nodes are splits.
export type LayoutNode = PanelNode | { type: 'split'; id: string; direction: Direction; children: LayoutNode[] };

export type DropZone = 'left' | 'right' | 'top' | 'bottom' | 'center';
export type DragPayload =
  | { type: 'pane'; panelId: string }
  | { type: 'tab'; tabId: string }
  | { type: 'tool'; kind: PanelKind; profileId?: string; extensionId?: string };

export type Tab = {
  id: string;
  title?: string; // user rename; otherwise the focused pane's title is shown
  root: LayoutNode;
  activePanelId: string;
};

// The whole tab set. Projects and saved layouts store these.
export type Snapshot = { tabs: Tab[]; activeTabId: string };

type WorkspaceState = Snapshot & {
  addTab: (kind?: PanelKind, profileId?: string, extensionId?: string) => void;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  duplicateTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  cycleTab: (step: number) => void;
  renameTab: (tabId: string, title: string) => void;
  renamePanel: (panelId: string, title: string) => void;
  focusPanel: (panelId: string) => void;
  splitPanel: (panelId: string, direction: Direction, kind?: PanelKind, profileId?: string, extensionId?: string) => void;
  closePanel: (panelId: string) => void;
  openTool: (kind: PanelKind, opts?: { split?: boolean; profileId?: string; extensionId?: string }) => void;
  moveTab: (tabId: string, toIndex: number) => void;
  drop: (payload: DragPayload, targetPanelId: string, zone: DropZone) => void;
  load: (snapshot: Snapshot) => void;
};

const uid = () => crypto.randomUUID();
export const newPanel = (kind: PanelKind, profileId?: string, extensionId?: string): PanelNode => ({ type: 'panel', id: uid(), kind, profileId, extensionId });

export function newTab(kind: PanelKind = 'terminal', profileId?: string, extensionId?: string): Tab {
  const root = newPanel(kind, profileId, extensionId);
  return { id: uid(), root, activePanelId: root.id };
}

export const emptySnapshot = (): Snapshot => {
  const tab = newTab();
  return { tabs: [tab], activeTabId: tab.id };
};

function replaceNode(node: LayoutNode, id: string, fn: (n: LayoutNode) => LayoutNode): LayoutNode {
  if (node.id === id) return fn(node);
  if (node.type === 'panel') return node;
  return { ...node, children: node.children.map((c) => replaceNode(c, id, fn)) };
}

// Returns null when the removed panel was the whole tree.
function removeNode(node: LayoutNode, id: string): LayoutNode | null {
  if (node.id === id) return null;
  if (node.type === 'panel') return node;
  const children = node.children.map((c) => removeNode(c, id)).filter((c): c is LayoutNode => c !== null);
  return children.length === 1 ? children[0] : { ...node, children };
}

// Folds a split into its parent when both run the same way, so repeated docking
// gives one row of equal panes instead of ever-deeper nesting.
function normalize(node: LayoutNode): LayoutNode {
  if (node.type === 'panel') return node;
  const children = node.children
    .map(normalize)
    .flatMap((c) => (c.type === 'split' && c.direction === node.direction ? c.children : [c]));
  return children.length === 1 ? children[0] : { ...node, children };
}

function swapPanels(node: LayoutNode, a: PanelNode, b: PanelNode): LayoutNode {
  if (node.type === 'panel') return node.id === a.id ? b : node.id === b.id ? a : node;
  return { ...node, children: node.children.map((c) => swapPanels(c, a, b)) };
}

// Copies a tree with new ids, so a restored or duplicated layout mounts fresh panes (new sessions).
function cloneNode(node: LayoutNode, ids: Map<string, string>): LayoutNode {
  const id = uid();
  ids.set(node.id, id);
  return node.type === 'panel' ? { ...node, id } : { ...node, id, children: node.children.map((c) => cloneNode(c, ids)) };
}

export function cloneTab(tab: Tab): Tab {
  const ids = new Map<string, string>();
  const root = cloneNode(tab.root, ids);
  return { ...tab, id: uid(), root, activePanelId: ids.get(tab.activePanelId) ?? firstPanelId(root) };
}

export function cloneSnapshot(s: Snapshot): Snapshot {
  const tabs = s.tabs.map(cloneTab);
  const i = Math.max(0, s.tabs.findIndex((t) => t.id === s.activeTabId));
  return { tabs, activeTabId: tabs[i].id };
}

export function firstPanelId(node: LayoutNode): string {
  return node.type === 'panel' ? node.id : firstPanelId(node.children[0]);
}

export function findPanel(node: LayoutNode, id: string): PanelNode | undefined {
  if (node.type === 'panel') return node.id === id ? node : undefined;
  for (const c of node.children) {
    const found = findPanel(c, id);
    if (found) return found;
  }
}

export const countPanels = (node: LayoutNode): number =>
  node.type === 'panel' ? 1 : node.children.reduce((n, c) => n + countPanels(c), 0);

export const useWorkspace = create<WorkspaceState>()(
  persist(
    (set, get) => {
      // Applies fn to the active tab.
      const updateActive = (fn: (t: Tab) => Tab) =>
        set((s) => ({ tabs: s.tabs.map((t) => (t.id === s.activeTabId ? fn(t) : t)) }));

      return {
        ...emptySnapshot(),

        addTab: (kind = 'terminal', profileId, extensionId) => {
          const tab = newTab(kind, profileId, extensionId);
          set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }));
        },

        closeTab: (tabId) =>
          set((s) => {
            const i = s.tabs.findIndex((t) => t.id === tabId);
            const tabs = s.tabs.filter((t) => t.id !== tabId);
            if (tabs.length === 0) return emptySnapshot();
            // Like Safari: closing the active tab selects its neighbour, not the last tab.
            const activeTabId = s.activeTabId === tabId ? tabs[Math.min(i, tabs.length - 1)].id : s.activeTabId;
            return { tabs, activeTabId };
          }),

        closeOtherTabs: (tabId) => set((s) => ({ tabs: s.tabs.filter((t) => t.id === tabId), activeTabId: tabId })),

        duplicateTab: (tabId) =>
          set((s) => {
            const i = s.tabs.findIndex((t) => t.id === tabId);
            const copy = cloneTab(s.tabs[i]);
            return { tabs: [...s.tabs.slice(0, i + 1), copy, ...s.tabs.slice(i + 1)], activeTabId: copy.id };
          }),

        setActiveTab: (activeTabId) => set({ activeTabId }),

        cycleTab: (step) =>
          set((s) => {
            const i = s.tabs.findIndex((t) => t.id === s.activeTabId);
            return { activeTabId: s.tabs[(i + step + s.tabs.length) % s.tabs.length].id };
          }),

        renameTab: (tabId, title) =>
          set((s) => ({ tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, title: title.trim() || undefined } : t)) })),

        renamePanel: (panelId, title) =>
          updateActive((t) => ({ ...t, root: replaceNode(t.root, panelId, (n) => ({ ...n, title: title.trim() || undefined })) })),

        // Skips the update when already focused: every click in a pane calls this, and a needless
        // state change would re-render the whole pane under the user's mouse.
        focusPanel: (activePanelId) => {
          const s = get();
          if (s.tabs.find((t) => t.id === s.activeTabId)?.activePanelId === activePanelId) return;
          updateActive((t) => ({ ...t, activePanelId }));
        },

        // Without a kind, the new pane copies the split one (same tool, same profile).
        splitPanel: (panelId, direction, kind, profileId, extensionId) => {
          const id = uid();
          updateActive((t) => ({
            ...t,
            activePanelId: id,
            root: normalize(
              replaceNode(t.root, panelId, (n) => {
                const added: PanelNode = kind ? { type: 'panel', id, kind, profileId, extensionId } : { ...(n as PanelNode), id, title: undefined };
                return { type: 'split', id: uid(), direction, children: [n, added] };
              }),
            ),
          }));
        },

        closePanel: (panelId) => {
          const { tabs, activeTabId, closeTab } = get();
          const tab = tabs.find((t) => t.id === activeTabId)!;
          const removed = removeNode(tab.root, panelId);
          if (!removed) return closeTab(tab.id);
          const root = normalize(removed);
          updateActive((t) => ({ ...t, root, activePanelId: firstPanelId(root) }));
        },

        // Tools are singletons by default: reuse a tab that already shows only this tool.
        // Terminals always open fresh. With split, the tool opens beside the focused pane.
        openTool: (kind, { split, profileId, extensionId } = {}) => {
          const s = get();
          if (split) {
            const tab = s.tabs.find((t) => t.id === s.activeTabId)!;
            return s.splitPanel(tab.activePanelId, 'horizontal', kind, profileId, extensionId);
          }
          const existing = kind !== 'terminal' && s.tabs.find((t) => t.root.type === 'panel' && t.root.kind === kind && t.root.extensionId === extensionId);
          if (existing) return s.setActiveTab(existing.id);
          s.addTab(kind, profileId, extensionId);
        },

        moveTab: (tabId, toIndex) =>
          set((s) => {
            const from = s.tabs.findIndex((t) => t.id === tabId);
            const tabs = [...s.tabs];
            const [tab] = tabs.splice(from, 1);
            tabs.splice(from < toIndex ? toIndex - 1 : toIndex, 0, tab);
            return { tabs };
          }),

        // Drops onto a pane of the active tab. Edge zones dock beside the target; centre swaps two panes.
        // A dropped tab brings its whole layout and closes; a dropped tool opens as a new pane.
        drop: (payload, targetPanelId, zone) => {
          const s = get();
          const tab = s.tabs.find((t) => t.id === s.activeTabId)!;
          let root = tab.root;
          let node: LayoutNode;
          let closeTabId: string | undefined;

          if (payload.type === 'pane') {
            const src = findPanel(root, payload.panelId);
            const target = findPanel(root, targetPanelId);
            if (!src || !target || src.id === target.id) return;
            if (zone === 'center') return updateActive((t) => ({ ...t, root: swapPanels(root, src, target), activePanelId: src.id }));
            root = removeNode(root, src.id)!; // never null: the target is still in the tree
            node = src;
          } else if (payload.type === 'tab') {
            if (payload.tabId === tab.id) return;
            node = s.tabs.find((t) => t.id === payload.tabId)!.root;
            closeTabId = payload.tabId;
          } else {
            node = newPanel(payload.kind, payload.profileId, payload.extensionId);
          }

          const edge = zone === 'center' ? 'right' : zone; // only panes can swap
          const direction: Direction = edge === 'left' || edge === 'right' ? 'horizontal' : 'vertical';
          const before = edge === 'left' || edge === 'top';
          root = normalize(
            replaceNode(root, targetPanelId, (n) => ({ type: 'split', id: uid(), direction, children: before ? [node, n] : [n, node] })),
          );
          set((st) => ({
            tabs: st.tabs
              .filter((t) => t.id !== closeTabId)
              .map((t) => (t.id === tab.id ? { ...t, root, activePanelId: firstPanelId(node) } : t)),
          }));
        },

        // Replaces every tab. Ids are regenerated so panes mount fresh: layout is restored, processes are not.
        load: (snapshot) => set(cloneSnapshot(snapshot)),
      };
    },
    {
      name: 'shellmoor-workspace',
      partialize: (s) => ({ tabs: s.tabs, activeTabId: s.activeTabId }),
      // Fresh ids on every launch: the layout comes back, stale sessions don't.
      merge: (persisted, current) => ({ ...current, ...(persisted ? cloneSnapshot(persisted as Snapshot) : {}) }),
    },
  ),
);
