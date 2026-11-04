import { useEffect } from 'react';
import { countPanels, emptySnapshot, useWorkspace } from '../store/workspace';
import { useUi } from '../store/ui';
import { useSettings } from '../store/settings';
import { confirm, useOverlays } from '../store/overlays';
import { onQuitRequested } from '../backend';
import { terminals } from '../components/Terminal';
import { getCommands, keyboard, keyFor, matchesKey } from '../commands';
import TitleBar from '../components/TitleBar';
import Sidebar from '../components/Sidebar';
import StatusBar from '../components/StatusBar';
import LayoutView from '../components/LayoutView';
import CommandPalette from '../components/CommandPalette';
import Settings from '../components/Settings';
import Sheets from '../components/Sheets';
import Overlays from '../components/Overlays';

// Honour "Reopen last session" once at launch; the workspace store restores tabs by default.
if (!useSettings.getState().restoreSession) useWorkspace.getState().load(emptySnapshot());
// First launch: show the Welcome sheet once.
if (!useSettings.getState().welcomed) (useUi.getState().open({ type: 'welcome' }), useSettings.getState().set({ welcomed: true }));

export default function Workspace() {
  // Text size: CSS zoom on #root scales every px and rem at once. The root uses h-full (not h-screen)
  // because vh units are multiplied by zoom and would overflow the window.
  const uiScale = useSettings((s) => s.uiScale);
  useEffect(() => {
    document.getElementById('root')!.style.zoom = String(uiScale);
  }, [uiScale]);
  const tabs = useWorkspace((s) => s.tabs);
  const activeTabId = useWorkspace((s) => s.activeTabId);
  const sidebarOpen = useUi((s) => s.sidebarOpen);

  // Capture phase so shortcuts work even while the terminal or editor has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useOverlays.getState().dialog || keyboard.recording) return; // dialogs and the shortcut recorder own the keyboard
      if (e.key === 'Escape' && useUi.getState().sheet) return useUi.getState().close();
      const command = getCommands().find((c) => {
        const key = keyFor(c);
        return key && matchesKey(e, key, c.alt);
      });
      if (!command) return;
      // Alt+Arrow moves lines in the editor; leave it there.
      if (command.alt && (e.target as HTMLElement).closest?.('.monaco-editor')) return;
      e.preventDefault();
      e.stopPropagation();
      command.run();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  // Quit handshake with Go: ask before closing while terminals are open (Settings › General).
  useEffect(
    () =>
      onQuitRequested(async () => {
        const open = terminals.size;
        if (!useSettings.getState().confirmQuitWithSessions || open === 0) return true;
        return confirm({
          title: 'Quit Shellmoor?',
          message: `${open} terminal${open > 1 ? 's are' : ' is'} still open. Running processes will be stopped.`,
          confirmLabel: 'Quit',
          destructive: true,
        });
      }),
    [],
  );

  // Floating glass sidebar on the left (full height, like macOS 26); toolbar, panes and status line to its right.
  return (
    <div className="flex h-full w-full gap-2 p-2 text-text">
      {sidebarOpen && <Sidebar />}
      <div className="flex min-w-0 flex-1 flex-col">
        <TitleBar />
        <main className="relative min-h-0 flex-1">
          {/* Inactive tabs stay mounted (hidden) so their sessions survive tab switches. */}
          {tabs.map((tab) => (
            <div key={tab.id} className={`h-full ${tab.id === activeTabId ? '' : 'hidden'}`}>
              <LayoutView node={tab.root} activePanelId={tab.activePanelId} split={countPanels(tab.root) > 1} />
            </div>
          ))}
        </main>
        <StatusBar />
      </div>
      <CommandPalette />
      <Settings />
      <Sheets />
      <Overlays />
    </div>
  );
}
