import type { ComponentType } from 'react';
import type { PanelKind } from '../store/workspace';
import Terminal from '../components/Terminal';
import Browser from './Browser';
import Files from './Files';
import Git from './Git';
import Ssh from './Ssh';
import Docker from './Docker';
import Kubernetes from './Kubernetes';
import Monitor from './Monitor';

export type PanelProps = { panelId: string };

// Add a new panel type: add it to PanelKind, then register it here.
export const panels: Record<PanelKind, { label: string; component: ComponentType<PanelProps> }> = {
  terminal: { label: 'Terminal', component: Terminal },
  browser: { label: 'Browser', component: Browser },
  files: { label: 'Files', component: Files },
  git: { label: 'Git', component: Git },
  ssh: { label: 'SSH', component: Ssh },
  docker: { label: 'Docker', component: Docker },
  kubernetes: { label: 'Kubernetes', component: Kubernetes },
  monitor: { label: 'System Monitor', component: Monitor },
};
