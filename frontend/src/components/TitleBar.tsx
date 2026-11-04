import { useState, type CSSProperties, type DragEvent } from 'react';
import { AppWindow, Bookmark, ChevronDown, Copy, Minus, PanelLeft, Pencil, Plus, Search, Settings, Square, UserRound, X, XSquare } from 'lucide-react';
import { contextMenu } from '../store/overlays';
import { FRAMELESS, windowControls } from '../backend';
import { findPanel, useWorkspace, type Tab } from '../store/workspace';
import { useProfiles } from '../store/profiles';
import { dragSource, endDrag, openSettings, useUi } from '../store/ui';
import { panels, paneTitle } from '../panels/registry';
import { getCommands, keyLabel } from '../commands';

const runCommand = (id: string) => getCommands().find((c) => c.id === id)?.run();
import { IconButton, Kbd, isMac } from '../ui';

const round = '!h-8 !w-8 !rounded-full';
// Wails reads this CSS property: the empty toolbar area drags the window; controls opt out.
const drag = { '--wails-draggable': 'drag' } as CSSProperties;
const noDrag = { '--wails-draggable': 'no-drag' } as CSSProperties;

function TabItem({ tab, active, insert }: { tab: Tab; active: boolean; insert?: 'before' | 'after' }) {
  const { setActiveTab, closeTab, renameTab } = useWorkspace();
  useProfiles((s) => s.profiles); // re-render when a profile is renamed
  const dragging = useUi((s) => s.drag);
  const [editing, setEditing] = useState(false);
  const pane = findPanel(tab.root, tab.activePanelId)!;
  const Icon = panels[pane.kind].icon;
  const title = tab.title ?? paneTitle(pane);
  const isSource = dragging?.type === 'tab' && dragging.tabId === tab.id;

  return (
    <div
      {...(editing ? {} : dragSource({ type: 'tab', tabId: tab.id }))}
      data-tab-id={tab.id}
      style={noDrag}
      onMouseDown={() => setActiveTab(tab.id)}
      onDoubleClick={() => setEditing(true)}
      onAuxClick={(e) => e.button === 1 && closeTab(tab.id)}
      onContextMenu={(e) => {
        setActiveTab(tab.id);
        const ws = useWorkspace.getState();
        contextMenu(e, [
          { label: 'Rename…', icon: Pencil, onSelect: () => setEditing(true) },
          { label: 'Duplicate', icon: Copy, onSelect: () => ws.duplicateTab(tab.id) },
          { label: 'Save as Layout…', icon: Bookmark, onSelect: () => runCommand('save-layout') },
          { label: 'Move to New Window', icon: AppWindow, onSelect: () => runCommand('move-tab-window') },
          'separator',
          { label: 'Close Other Tabs', icon: XSquare, disabled: ws.tabs.length < 2, onSelect: () => ws.closeOtherTabs(tab.id) },
          { label: 'Close Tab', icon: X, shortcut: keyLabel('KeyW'), onSelect: () => closeTab(tab.id) },
        ]);
      }}
      title={`${title} (double-click to rename)`}
      className={`group relative flex h-7 min-w-28 max-w-60 flex-1 items-center justify-center gap-1.5 rounded-full px-7 transition-all ${
        active ? 'bg-white text-black shadow-[0_1px_4px_rgb(0_0_0/0.15)] dark:bg-text/15 dark:text-text' : 'text-muted hover:bg-text/7 hover:text-text'
      } ${isSource ? 'opacity-40' : ''}`}
    >
      {insert && <span className={`absolute inset-y-0.5 w-0.5 rounded-full bg-accent ${insert === 'before' ? '-left-[3px]' : '-right-[3px]'}`} />}
      <Icon size={13} strokeWidth={1.9} className="shrink-0" />
      {editing ? (
        <input
          autoFocus
          defaultValue={title}
          onBlur={(e) => {
            renameTab(tab.id, e.target.value);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="w-24 min-w-0 bg-transparent text-center outline-none"
        />
      ) : (
        <span className="truncate font-medium">{title}</span>
      )}
      {/* Close sits on the left edge like Safari, revealed on hover. */}
      <button
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => closeTab(tab.id)}
        aria-label="Close tab"
        className="absolute left-1.5 flex h-5 w-5 items-center justify-center rounded-full opacity-0 transition-opacity hover:bg-text/12 group-hover:opacity-100"
      >
        <X size={11} strokeWidth={2.25} />
      </button>
    </div>
  );
}

// "New Tab with Profile" menu, like Terminal.app.
function NewTabMenu({ onClose }: { onClose: () => void }) {
  const { profiles, defaultId } = useProfiles();
  const addTab = useWorkspace((s) => s.addTab);

  const item = 'flex h-7 w-full items-center gap-2.5 rounded-md px-2.5 text-left hover:bg-accent hover:text-bg';
  return (
    <>
      <div className="fixed inset-0 z-30" onMouseDown={onClose} />
      <div className="glass absolute right-0 top-full z-40 mt-2 w-64 animate-pop rounded-xl p-1.5">
        <div className="px-2.5 pb-1 pt-0.5 text-[11px] font-semibold text-muted">New Tab with Profile</div>
        {profiles.map((p) => (
          <button key={p.id} className={item} onClick={() => (addTab('terminal', p.id), onClose())}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
            <span className="flex-1">{p.name}</span>
            {p.id === defaultId && <span className="text-[11px] opacity-60">{keyLabel('KeyT')}</span>}
          </button>
        ))}
        <div className="mx-2.5 my-1 border-t border-border" />
        <button className={item} onClick={() => (openSettings('profiles'), onClose())}>
          <UserRound size={13} />
          Edit Profiles…
        </button>
      </div>
    </>
  );
}

export default function TitleBar() {
  const { tabs, activeTabId, addTab, moveTab } = useWorkspace();
  const defaultId = useProfiles((s) => s.defaultId);
  const { sidebarOpen, toggleSidebar, open } = useUi();
  const dragging = useUi((s) => s.drag);
  const [menu, setMenu] = useState(false);
  const [insertAt, setInsertAt] = useState<number | null>(null); // tab reorder position

  // Tabs reorder by drag; tools dropped on the bar open as new tabs.
  // The index is computed from the pointer on every event, so drop never relies on dragover's state having landed.
  const indexAt = (e: DragEvent) => {
    const els = [...e.currentTarget.querySelectorAll<HTMLElement>('[data-tab-id]')];
    const i = els.findIndex((el) => {
      const r = el.getBoundingClientRect();
      return e.clientX < r.left + r.width / 2;
    });
    return i === -1 ? els.length : i;
  };
  const onDragOver = (e: DragEvent) => {
    if (dragging?.type !== 'tab' && dragging?.type !== 'tool') return;
    e.preventDefault();
    if (dragging.type === 'tab') setInsertAt(indexAt(e));
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    if (dragging?.type === 'tab') moveTab(dragging.tabId, indexAt(e));
    if (dragging?.type === 'tool') addTab(dragging.kind, dragging.profileId);
    setInsertAt(null);
    endDrag();
  };

  // relative z-30 on the header: the glass groups create stacking contexts, so without it the panes paint over toolbar menus.
  return (
    <header className="relative z-30 flex h-12 shrink-0 items-start gap-2" style={FRAMELESS ? drag : undefined}>
      {!sidebarOpen && (
        <div className="glass flex rounded-full p-1" style={noDrag}>
          <IconButton icon={PanelLeft} label={`Show sidebar (${keyLabel('KeyB')})`} className={round} onClick={toggleSidebar} />
        </div>
      )}

      <nav
        onDragOver={onDragOver}
        onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setInsertAt(null)}
        onDrop={onDrop}
        className={`glass flex h-10 min-w-0 flex-1 items-center gap-1 rounded-full p-1 transition-shadow ${dragging?.type === 'tool' ? 'ring-2 ring-accent/50' : ''}`}
      >
        <div className="flex min-w-0 flex-1 gap-1 overflow-hidden px-1">
          {tabs.map((t, i) => (
            <TabItem
              key={t.id}
              tab={t}
              active={t.id === activeTabId}
              insert={insertAt === i ? 'before' : insertAt === tabs.length && i === tabs.length - 1 ? 'after' : undefined}
            />
          ))}
        </div>
        <div className="relative flex shrink-0 items-center" style={noDrag}>
          <IconButton icon={Plus} label={`New tab (${keyLabel('KeyT')})`} className={round} onClick={() => addTab('terminal', defaultId)} />
          <IconButton icon={ChevronDown} size={13} label="New tab with profile" className="!h-8 !w-6 !rounded-full" onClick={() => setMenu(!menu)} />
          {menu && <NewTabMenu onClose={() => setMenu(false)} />}
        </div>
      </nav>

      <div className="glass flex h-10 shrink-0 items-center gap-1 rounded-full p-1" style={noDrag}>
        <button
          onClick={() => open({ type: 'palette' })}
          className="hidden h-8 w-60 items-center gap-2 whitespace-nowrap rounded-full px-3 text-muted transition-colors hover:bg-text/7 hover:text-text lg:flex"
        >
          <Search size={14} />
          <span className="flex-1 text-left">Search</span>
          <Kbd>{keyLabel('KeyP')}</Kbd>
        </button>
        <IconButton icon={Search} label="Search" className={`${round} lg:hidden`} onClick={() => open({ type: 'palette' })} />
        <IconButton icon={Settings} label={`Settings (${keyLabel('Comma')})`} className={round} onClick={() => openSettings()} />
      </div>

      {/* Our own window controls when the native frame is off (Windows/Linux; macOS keeps its traffic lights). */}
      {FRAMELESS && !isMac && (
        <div className="glass flex h-10 shrink-0 items-center gap-0.5 rounded-full p-1" style={noDrag}>
          <IconButton icon={Minus} label="Minimise" className={round} onClick={windowControls.minimise} />
          <IconButton icon={Square} size={12} label="Maximise" className={round} onClick={windowControls.toggleMaximise} />
          <IconButton icon={X} label="Close" className={`${round} hover:!bg-danger hover:!text-white`} onClick={windowControls.close} />
        </div>
      )}
    </header>
  );
}
