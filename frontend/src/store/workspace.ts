import { create } from 'zustand';

export type PanelKind = 'terminal' | 'browser' | 'files' | 'git' | 'ssh' | 'docker' | 'kubernetes' | 'monitor';
export type Direction = 'horizontal' | 'vertical';

// A tab's layout is a tree: leaves are panels, inner nodes are splits.
export type LayoutNode =
  | { type: 'panel'; id: string; kind: PanelKind }
  | { type: 'split'; id: string; direction: Direction; children: LayoutNode[] };

export type Tab = {
  id: string;
  title: string;
  root: LayoutNode;
  activePanelId: string;
};

type WorkspaceState = {
  tabs: Tab[];
  activeTabId: string;
  addTab: (kind?: PanelKind) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  renameTab: (tabId: string, title: string) => void;
  focusPanel: (panelId: string) => void;
  splitPanel: (panelId: string, direction: Direction, kind?: PanelKind) => void;
  closePanel: (panelId: string) => void;
  setPanelKind: (panelId: string, kind: PanelKind) => void;
};

const uid = () => crypto.randomUUID();
const newPanel = (kind: PanelKind): LayoutNode => ({ type: 'panel', id: uid(), kind });

function newTab(kind: PanelKind): Tab {
  const root = newPanel(kind);
  return { id: uid(), title: kind, root, activePanelId: root.id };
}

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

export function firstPanelId(node: LayoutNode): string {
  return node.type === 'panel' ? node.id : firstPanelId(node.children[0]);
}

const first = newTab('terminal');

export const useWorkspace = create<WorkspaceState>((set) => {
  // Applies fn to the active tab.
  const updateActive = (fn: (t: Tab) => Tab) =>
    set((s) => ({ tabs: s.tabs.map((t) => (t.id === s.activeTabId ? fn(t) : t)) }));

  return {
    tabs: [first],
    activeTabId: first.id,

    addTab: (kind = 'terminal') => {
      const tab = newTab(kind);
      set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }));
    },

    closeTab: (tabId) =>
      set((s) => {
        const tabs = s.tabs.filter((t) => t.id !== tabId);
        if (tabs.length === 0) {
          const tab = newTab('terminal');
          return { tabs: [tab], activeTabId: tab.id };
        }
        const activeTabId = s.activeTabId === tabId ? tabs[tabs.length - 1].id : s.activeTabId;
        return { tabs, activeTabId };
      }),

    setActiveTab: (activeTabId) => set({ activeTabId }),

    renameTab: (tabId, title) =>
      set((s) => ({ tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, title } : t)) })),

    focusPanel: (activePanelId) => updateActive((t) => ({ ...t, activePanelId })),

    splitPanel: (panelId, direction, kind = 'terminal') => {
      const added = newPanel(kind);
      updateActive((t) => ({
        ...t,
        activePanelId: added.id,
        root: replaceNode(t.root, panelId, (n) => ({ type: 'split', id: uid(), direction, children: [n, added] })),
      }));
    },

    closePanel: (panelId) => {
      const { tabs, activeTabId, closeTab } = useWorkspace.getState();
      const tab = tabs.find((t) => t.id === activeTabId)!;
      const root = removeNode(tab.root, panelId);
      if (!root) return closeTab(tab.id);
      updateActive((t) => ({ ...t, root, activePanelId: firstPanelId(root) }));
    },

    // New id so the old panel's component unmounts cleanly.
    setPanelKind: (panelId, kind) => {
      const id = uid();
      updateActive((t) => ({
        ...t,
        activePanelId: id,
        root: replaceNode(t.root, panelId, () => ({ type: 'panel', id, kind })),
      }));
    },
  };
});
