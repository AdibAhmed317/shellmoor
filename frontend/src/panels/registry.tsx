import { lazy, Suspense, type ComponentType } from 'react';
import { Activity, Container, FileCode, GitBranch, Globe, ListChecks, Puzzle, Server, ShipWheel, Sparkles, SquareTerminal, type LucideIcon } from 'lucide-react';
import Extension from './Extension';
import { extensionById, useExtensions } from '../store/extensions';
import Tasks from './Tasks';
import Assistant from './Assistant';
import type { PanelKind, PanelNode } from '../store/workspace';
import { profileById } from '../store/profiles';
import Terminal from '../components/Terminal';
import Browser from './Browser';
import Git from './Git';
import Ssh from './Ssh';
import Docker from './Docker';
import Kubernetes from './Kubernetes';
import Monitor from './Monitor';

// Monaco is ~4 MB, so it only loads when an editor panel is first opened.
const LazyEditor = lazy(() => import('./Editor'));
const Editor = () => (
  <Suspense fallback={<div className="flex h-full items-center justify-center text-muted">Loading editor…</div>}>
    <LazyEditor />
  </Suspense>
);

export type PanelProps = { panelId: string; profileId?: string; extensionId?: string };

export type ToolSection = 'Workspace' | 'Infrastructure' | 'System' | 'Extensions';

// Add a new panel type: add it to PanelKind, then register it here. Order = sidebar order.
export const panels: Record<PanelKind, { label: string; icon: LucideIcon; section: ToolSection; component: ComponentType<PanelProps> }> = {
  terminal: { label: 'Terminal', icon: SquareTerminal, section: 'Workspace', component: Terminal },
  editor: { label: 'Editor', icon: FileCode, section: 'Workspace', component: Editor },
  git: { label: 'Source Control', icon: GitBranch, section: 'Workspace', component: Git },
  browser: { label: 'Browser', icon: Globe, section: 'Workspace', component: Browser },
  ssh: { label: 'Remote Hosts', icon: Server, section: 'Infrastructure', component: Ssh },
  docker: { label: 'Docker', icon: Container, section: 'Infrastructure', component: Docker },
  kubernetes: { label: 'Kubernetes', icon: ShipWheel, section: 'Infrastructure', component: Kubernetes },
  monitor: { label: 'Activity', icon: Activity, section: 'System', component: Monitor },
  tasks: { label: 'Tasks', icon: ListChecks, section: 'Workspace', component: Tasks },
  ai: { label: 'Assistant', icon: Sparkles, section: 'System', component: Assistant },
  extension: { label: 'Extension', icon: Puzzle, section: 'Extensions', component: Extension },
};

export const paneTitle = (p: PanelNode): string => p.title ?? paneLabel(p) ?? (p.kind === 'terminal' ? profileById(p.profileId).name : panels[p.kind].label);
export const paneLabel = (p: PanelNode) => (p.kind === 'extension' ? (extensionById(p.extensionId)?.name ?? 'Extension') : undefined);

// Built-in tools the user hasn't switched off (Settings › Extensions). Terminal and extension panes are listed separately.
export function enabledTools(): [PanelKind, (typeof panels)[PanelKind]][] {
  const off = useExtensions.getState().disabledTools;
  return (Object.entries(panels) as [PanelKind, (typeof panels)[PanelKind]][]).filter(([k]) => k !== 'terminal' && k !== 'extension' && !off.includes(k));
}
