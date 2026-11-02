import { useEffect } from 'react';
import { useWorkspace } from '../store/workspace';
import { useTheme } from '../store/theme';
import TabBar from '../components/TabBar';
import StatusBar from '../components/StatusBar';
import LayoutView from '../components/LayoutView';

export default function Workspace() {
  const tabs = useWorkspace((s) => s.tabs);
  const activeTabId = useWorkspace((s) => s.activeTabId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || !e.shiftKey) return;
      // Shift turns [ ] into { }, so match the physical key.
      if (e.code === 'BracketLeft' || e.code === 'BracketRight') {
        e.preventDefault();
        return useTheme.getState().cycle(e.code === 'BracketRight' ? 1 : -1);
      }
      const s = useWorkspace.getState();
      const panelId = s.tabs.find((t) => t.id === s.activeTabId)!.activePanelId;
      const actions: Record<string, () => void> = {
        T: () => s.addTab(),
        D: () => s.splitPanel(panelId, 'horizontal'),
        E: () => s.splitPanel(panelId, 'vertical'),
        W: () => s.closePanel(panelId),
      };
      const action = actions[e.key.toUpperCase()];
      if (action) {
        e.preventDefault();
        action();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col bg-bg text-text">
      <TabBar />
      {/* Inactive tabs stay mounted (hidden) so their sessions survive tab switches. */}
      {tabs.map((tab) => (
        <div key={tab.id} className={`min-h-0 flex-1 p-1 ${tab.id === activeTabId ? '' : 'hidden'}`}>
          <LayoutView node={tab.root} activePanelId={tab.activePanelId} />
        </div>
      ))}
      <StatusBar />
    </div>
  );
}
