import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CursorStyle = 'block' | 'bar' | 'underline';

export type Profile = {
  id: string;
  name: string;
  color: string; // dot shown in menus and tab titles
  shell: string;
  args: string;
  cwd: string;
  env: string; // KEY=value per line
  themeId: string | null; // null = follow app theme
  fontFamily: string;
  fontSize: number;
  cursorStyle: CursorStyle;
  cursorBlink: boolean;
};

const isWindows = navigator.userAgent.includes('Windows');

export const shellSuggestions = isWindows
  ? ['powershell.exe', 'pwsh.exe', 'cmd.exe', 'C:\\Program Files\\Git\\bin\\bash.exe', 'wsl.exe']
  : ['/bin/zsh', '/bin/bash', '/usr/bin/fish', '/bin/sh'];

const base = {
  args: '',
  cwd: '~',
  env: '',
  themeId: null,
  fontFamily: 'JetBrains Mono Variable', // bundled with the app
  fontSize: 14,
  cursorStyle: 'block' as CursorStyle,
  cursorBlink: true,
};

const defaults: Profile[] = isWindows
  ? [
      { ...base, id: 'powershell', name: 'PowerShell', color: '#61afef', shell: 'powershell.exe', args: '-NoLogo' },
      { ...base, id: 'cmd', name: 'Command Prompt', color: '#abb2bf', shell: 'cmd.exe' },
      { ...base, id: 'git-bash', name: 'Git Bash', color: '#e06c75', shell: 'C:\\Program Files\\Git\\bin\\bash.exe', args: '--login -i' },
      { ...base, id: 'wsl', name: 'WSL', color: '#e5c07b', shell: 'wsl.exe', themeId: 'gruvbox-dark' },
    ]
  : [
      { ...base, id: 'zsh', name: 'zsh', color: '#5fd4b0', shell: '/bin/zsh', args: '-l' },
      { ...base, id: 'bash', name: 'bash', color: '#e5c07b', shell: '/bin/bash', args: '-l' },
    ];

type ProfilesState = {
  profiles: Profile[];
  defaultId: string;
  add: () => string;
  duplicate: (id: string) => string;
  update: (id: string, patch: Partial<Profile>) => void;
  remove: (id: string) => void;
  setDefault: (id: string) => void;
};

export const useProfiles = create<ProfilesState>()(
  persist(
    (set, get) => {
      const insert = (p: Profile) => {
        set((s) => ({ profiles: [...s.profiles, p] }));
        return p.id;
      };
      return {
        profiles: defaults,
        defaultId: defaults[0].id,
        add: () => insert({ ...base, id: crypto.randomUUID(), name: 'New profile', color: '#c678dd', shell: shellSuggestions[0] }),
        duplicate: (id) => {
          const src = get().profiles.find((p) => p.id === id)!;
          return insert({ ...src, id: crypto.randomUUID(), name: `${src.name} copy` });
        },
        update: (id, patch) => set((s) => ({ profiles: s.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
        remove: (id) =>
          set((s) => {
            if (s.profiles.length === 1) return s; // always keep one
            const profiles = s.profiles.filter((p) => p.id !== id);
            return { profiles, defaultId: s.defaultId === id ? profiles[0].id : s.defaultId };
          }),
        setDefault: (defaultId) => set({ defaultId }),
      };
    },
    { name: 'shellmoor-profiles' },
  ),
);

// Falls back to the default profile when the id is missing or was deleted.
export function profileById(id?: string): Profile {
  const { profiles, defaultId } = useProfiles.getState();
  return profiles.find((p) => p.id === id) ?? profiles.find((p) => p.id === defaultId) ?? profiles[0];
}
