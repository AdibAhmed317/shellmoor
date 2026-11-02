import { useState } from 'react';
import { useWorkspace, type PanelKind } from '../store/workspace';
import { panels } from '../panels/registry';
import ThemePicker from './ThemePicker';

export default function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab, addTab } = useWorkspace();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border bg-surface px-2 text-sm">
      <span className="mr-3 font-semibold text-accent">shellmoor</span>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`group flex cursor-pointer items-center gap-2 rounded px-3 py-1 ${
            tab.id === activeTabId ? 'bg-bg text-text' : 'text-muted hover:text-text'
          }`}
        >
          {tab.title}
          <button
            onClick={(e) => {
              e.stopPropagation();
              closeTab(tab.id);
            }}
            className="opacity-0 group-hover:opacity-100 hover:text-accent"
            aria-label="Close tab"
          >
            ×
          </button>
        </div>
      ))}
      <div className="relative">
        <button onClick={() => setMenuOpen(!menuOpen)} className="px-2 text-muted hover:text-accent" aria-label="New tab">
          +
        </button>
        {menuOpen && (
          <div
            className="absolute left-0 top-full z-10 mt-1 min-w-36 rounded-md border border-border bg-surface py-1 shadow-lg"
            onMouseLeave={() => setMenuOpen(false)}
          >
            {Object.entries(panels).map(([kind, p]) => (
              <button
                key={kind}
                onClick={() => {
                  addTab(kind as PanelKind);
                  setMenuOpen(false);
                }}
                className="block w-full px-3 py-1 text-left text-muted hover:bg-bg hover:text-accent"
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <span className="flex-1" />
      <ThemePicker />
    </div>
  );
}
