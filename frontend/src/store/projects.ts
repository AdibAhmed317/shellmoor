// Projects: a name, a folder and the tabs you had open there. Switching saves the current
// tabs into the old project and restores the new one's.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { emptySnapshot, useWorkspace, type Snapshot } from './workspace';

export type Project = {
  id: string;
  name: string;
  path: string; // working directory for its terminals (backend: validate against allowed paths)
  pinned: boolean;
  lastOpened: number;
  snapshot?: Snapshot;
};

type ProjectsState = {
  projects: Project[];
  currentId: string;
  create: (p: { name: string; path: string; snapshot?: Snapshot }) => void;
  switchTo: (id: string) => void;
  update: (id: string, patch: Partial<Pick<Project, 'name' | 'path' | 'pinned'>>) => void;
  remove: (id: string) => void;
};

const home: Project = { id: 'home', name: 'Home', path: '~', pinned: true, lastOpened: Date.now() };

const currentSnapshot = (): Snapshot => {
  const { tabs, activeTabId } = useWorkspace.getState();
  return { tabs, activeTabId };
};

export const useProjects = create<ProjectsState>()(
  persist(
    (set, get) => ({
      projects: [home],
      currentId: home.id,

      create: ({ name, path, snapshot }) => {
        const project: Project = { id: crypto.randomUUID(), name, path, pinned: false, lastOpened: Date.now(), snapshot: snapshot ?? emptySnapshot() };
        set((s) => ({ projects: [...s.projects, project] }));
        get().switchTo(project.id);
      },

      switchTo: (id) => {
        const { currentId, projects } = get();
        if (id === currentId) return;
        const target = projects.find((p) => p.id === id);
        if (!target) return;
        set({
          currentId: id,
          projects: projects.map((p) =>
            p.id === currentId ? { ...p, snapshot: currentSnapshot() } : p.id === id ? { ...p, lastOpened: Date.now() } : p,
          ),
        });
        useWorkspace.getState().load(target.snapshot ?? emptySnapshot());
      },

      update: (id, patch) => set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),

      remove: (id) => {
        if (id === get().currentId) return; // switch away first
        set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
      },
    }),
    { name: 'shellmoor-projects' },
  ),
);

export const currentProject = () => {
  const { projects, currentId } = useProjects.getState();
  return projects.find((p) => p.id === currentId) ?? projects[0];
};
