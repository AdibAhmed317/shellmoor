import { findPanel, useWorkspace } from '../store/workspace';
import { profileById, useProfiles } from '../store/profiles';
import { useTheme } from '../store/theme';
import { openSettings } from '../store/ui';
import { useProjects } from '../store/projects';
import { paneTitle } from '../panels/registry';
import { themeById } from '../themes';
import { StatusDot } from '../ui';

// Deliberately quiet: one line of context, no chrome.
export default function StatusBar() {
  const { tabs, activeTabId } = useWorkspace();
  useProfiles((s) => s.profiles);
  const themeName = useTheme((s) => themeById(s.themeId).name);
  const project = useProjects((s) => s.projects.find((p) => p.id === s.currentId) ?? s.projects[0]);

  const tab = tabs.find((t) => t.id === activeTabId)!;
  const pane = findPanel(tab.root, tab.activePanelId)!;
  const profile = pane.kind === 'terminal' ? profileById(pane.profileId) : null;

  return (
    <footer className="flex h-7 shrink-0 items-center gap-2 px-2 pt-1 text-[11px] text-muted">
      <StatusDot tone="success" />
      <span>Local</span>
      <span className="opacity-40">/</span>
      <span>{project.name}</span>
      <span className="opacity-40">/</span>
      <span className="text-text/75">{paneTitle(pane)}</span>
      {profile && (
        <>
          <span className="opacity-40">/</span>
          <span className="truncate">{profile.cwd}</span>
        </>
      )}
      <span className="flex-1" />
      <button onClick={() => openSettings('appearance')} className="rounded px-1 hover:text-text">
        {themeName}
      </button>
    </footer>
  );
}
