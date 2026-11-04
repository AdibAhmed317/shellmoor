// App preferences (Settings sheet). Never put secrets here: it persists to localStorage.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AiProvider = 'anthropic' | 'openai' | 'ollama' | 'custom';

export type Settings = {
  // General
  restoreSession: boolean; // reopen last tabs on launch
  confirmQuitWithSessions: boolean;
  defaultProjectFolder: string;
  // Terminal
  scrollback: number;
  copyOnSelect: boolean;
  rightClick: 'menu' | 'paste';
  bell: 'none' | 'visual' | 'sound';
  logging: boolean;
  logRetentionDays: number;
  logFolder: string;
  // Notifications
  notifyOnFinish: boolean;
  notifyAfterSeconds: number;
  notifyOnlyInBackground: boolean;
  // Security
  allowedPaths: string[];
  // AI (optional; the app works without it)
  aiEnabled: boolean;
  aiProvider: AiProvider;
  aiModel: string;
  aiEndpoint: string;
  aiKeyConfigured: boolean; // the key itself lives in the OS keychain (backend), never here
  aiShareTerminal: boolean;
  aiShareFiles: boolean; // suggested commands always need confirmation (spec); not a setting
  // Keyboard: command id -> KeyboardEvent.code, overriding the default
  keymap: Record<string, string>;
  welcomed: boolean; // first-run Welcome sheet seen
  uiScale: number; // whole-app zoom (Settings › Appearance › Text size)
};

export const defaultSettings: Settings = {
  restoreSession: true,
  confirmQuitWithSessions: true,
  defaultProjectFolder: '~/projects',
  scrollback: 10000,
  copyOnSelect: false,
  rightClick: 'menu',
  bell: 'visual',
  logging: false,
  logRetentionDays: 14,
  logFolder: '~/.shellmoor/logs',
  notifyOnFinish: true,
  notifyAfterSeconds: 10,
  notifyOnlyInBackground: true,
  allowedPaths: ['~/projects', '~/.ssh/config'],
  aiEnabled: false,
  aiProvider: 'anthropic',
  aiModel: 'claude-sonnet-5-5',
  aiEndpoint: '',
  aiKeyConfigured: false,
  aiShareTerminal: true,
  aiShareFiles: false,
  keymap: {},
  welcomed: false,
  uiScale: 1.1,
};

type SettingsState = Settings & {
  set: (patch: Partial<Settings>) => void;
  reset: () => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,
      set: (patch) => set(patch),
      reset: () => set(defaultSettings),
    }),
    { name: 'shellmoor-settings' },
  ),
);
