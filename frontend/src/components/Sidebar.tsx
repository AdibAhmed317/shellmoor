import { ChevronsUpDown, Columns2, FolderOpen, History, LayoutTemplate, PanelLeft, Plus, Settings } from 'lucide-react';
import { useProjects } from '../store/projects';
import { findPanel, useWorkspace, type PanelKind } from '../store/workspace';
import { useProfiles } from '../store/profiles';
import { dragSource, openSettings, useUi } from '../store/ui';
import { enabledTools, panels, type ToolSection } from '../panels/registry';
import { useExtensions } from '../store/extensions';
import { keyLabel } from '../commands';
import { IconButton, ListRow, SectionLabel } from '../ui';

const sections: ToolSection[] = ['Workspace', 'Infrastructure', 'System'];

// Floating glass source list, like Finder in macOS 26. Click opens (or switches to) a tool;
// the hover split button opens it beside the current pane.
export default function Sidebar() {
  const { tabs, activeTabId, openTool, addTab } = useWorkspace();
  const { profiles, defaultId } = useProfiles();
  // Select the stable array and filter outside: a selector returning a new array loops forever in Zustand v5.
  const extensions = useExtensions((s) => s.extensions).filter((x) => x.enabled);
  useExtensions((s) => s.disabledTools); // re-render when tools are switched on or off
  const { toggleSidebar, open } = useUi();
  const project = useProjects((s) => s.projects.find((p) => p.id === s.currentId) ?? s.projects[0]);
  const tab = tabs.find((t) => t.id === activeTabId)!;
  const focused = findPanel(tab.root, tab.activePanelId)!;
  const focusedProfile = focused.kind === 'terminal' ? (focused.profileId ?? defaultId) : null;

  const splitButton = (kind: PanelKind, profileId?: string, extensionId?: string) => (
    <IconButton
      icon={Columns2}
      size={13}
      label="Open in split"
      className="!h-5 !w-5 opacity-0 group-hover:opacity-100"
      onClick={(e) => {
        e.stopPropagation();
        openTool(kind, { split: true, profileId, extensionId });
      }}
    />
  );

  return (
    <aside className="glass flex w-60 shrink-0 animate-fade flex-col rounded-2xl">
      {/* Current project; click to switch (like Xcode's scheme / Finder's location picker). */}
      <div className="flex h-12 shrink-0 items-center gap-1 pl-2 pr-2">
        <button
          onClick={() => open({ type: 'projects' })}
          title={`Switch project (${keyLabel('KeyO')})`}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-text/6"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <FolderOpen size={15} strokeWidth={1.9} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold leading-tight">{project.name}</span>
            <span className="block truncate text-[11px] leading-tight text-muted">{project.path}</span>
          </span>
          <ChevronsUpDown size={13} className="shrink-0 text-muted" />
        </button>
        <IconButton icon={PanelLeft} label={`Hide sidebar (${keyLabel('KeyB')})`} className="!rounded-full" onClick={toggleSidebar} />
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-2">
        <div>
          <SectionLabel
            action={<IconButton icon={Plus} size={13} label="New terminal" className="!h-5 !w-5" onClick={() => addTab('terminal', defaultId)} />}
          >
            Terminals
          </SectionLabel>
          {profiles.map((p) => (
            <div key={p.id} {...dragSource({ type: 'tool', kind: 'terminal', profileId: p.id })}>
              <ListRow
                icon={panels.terminal.icon}
                iconColor={p.color}
                title={p.name}
                selected={focusedProfile === p.id}
                onClick={() => addTab('terminal', p.id)}
                trailing={splitButton('terminal', p.id)}
              />
            </div>
          ))}
        </div>

        {sections.map((section) => {
          const tools = enabledTools().filter(([, p]) => p.section === section);
          return (
            tools.length > 0 && (
              <div key={section}>
                <SectionLabel>{section}</SectionLabel>
                {tools.map(([kind, p]) => (
                  <div key={kind} {...dragSource({ type: 'tool', kind })}>
                    <ListRow icon={p.icon} title={p.label} selected={focused.kind === kind} onClick={() => openTool(kind)} trailing={splitButton(kind)} />
                  </div>
                ))}
              </div>
            )
          );
        })}

        {extensions.length > 0 && (
          <div>
            <SectionLabel>Extensions</SectionLabel>
            {extensions.map((x) => (
              <div key={x.id} {...dragSource({ type: 'tool', kind: 'extension', extensionId: x.id })}>
                <ListRow
                  icon={panels.extension.icon}
                  title={x.name}
                  selected={focused.kind === 'extension' && focused.extensionId === x.id}
                  onClick={() => openTool('extension', { extensionId: x.id })}
                  trailing={splitButton('extension', undefined, x.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-px py-2">
        <ListRow icon={LayoutTemplate} iconColor="var(--color-muted)" title="Layouts" onClick={() => open({ type: 'layouts' })} trailing={<span className="text-[11px] text-muted">{keyLabel('KeyL')}</span>} />
        <ListRow icon={History} iconColor="var(--color-muted)" title="History" onClick={() => open({ type: 'history' })} trailing={<span className="text-[11px] text-muted">{keyLabel('KeyH')}</span>} />
        <ListRow icon={Settings} iconColor="var(--color-muted)" title="Settings" onClick={() => openSettings()} trailing={<span className="text-[11px] text-muted">{keyLabel('Comma')}</span>} />
      </div>
    </aside>
  );
}
