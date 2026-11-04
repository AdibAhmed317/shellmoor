import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Bell, Check, Copy, Download, Info, Keyboard, Lock, Palette, Plus, RotateCcw, Settings as Gear, Shuffle, Sparkles, SquareTerminal, Terminal as TerminalIcon,
  Puzzle, Trash, Upload, X, type LucideIcon,
} from 'lucide-react';
import { openSettings, useUi, type SettingsSection } from '../store/ui';
import { useTheme } from '../store/theme';
import { shellSuggestions, useProfiles, type CursorStyle } from '../store/profiles';
import { useSettings, type AiProvider } from '../store/settings';
import { useWorkspace } from '../store/workspace';
import { confirm, prompt, toast } from '../store/overlays';
import { deleteSecret, downloadFile, notify, pickFolder, readExtensionFolder, saveSecret } from '../backend';
import { useExtensions } from '../store/extensions';
import { panels } from '../panels/registry';
import type { PanelKind } from '../store/workspace';
import { themes, type Theme } from '../themes';
import { getCommands, keyboard, keyFor, keyLabel, type Command } from '../commands';
import { Button, Group, GroupRow, IconButton, Kbd, Segmented, Tile, Toggle, cx, field, isMac } from '../ui';

// Tile colours follow System Settings.
const sections: { id: SettingsSection; label: string; icon: LucideIcon; color: string }[] = [
  { id: 'general', label: 'General', icon: Gear, color: '#8e8e93' },
  { id: 'appearance', label: 'Appearance', icon: Palette, color: '#0a84ff' },
  { id: 'profiles', label: 'Profiles', icon: SquareTerminal, color: '#30b46c' },
  { id: 'terminal', label: 'Terminal', icon: TerminalIcon, color: '#3a3a3c' },
  { id: 'notifications', label: 'Notifications', icon: Bell, color: '#ff3b30' },
  { id: 'security', label: 'Privacy & Security', icon: Lock, color: '#5856d6' },
  { id: 'ai', label: 'AI Assistant', icon: Sparkles, color: '#af52de' },
  { id: 'extensions', label: 'Extensions', icon: Puzzle, color: '#ff9f0a' },
  { id: 'shortcuts', label: 'Keyboard', icon: Keyboard, color: '#8e8e93' },
  { id: 'about', label: 'About', icon: Info, color: '#8e8e93' },
];

function Title({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex h-8 items-center gap-3">
      <h2 className="flex-1 text-[20px] font-bold tracking-tight text-text">{children}</h2>
      {action}
    </div>
  );
}

const control = `${field} !w-64`;

// ---------- General ----------

const STORE_PREFIX = 'shellmoor-';

function General() {
  const s = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);

  // Everything Shellmoor keeps in localStorage. Secrets are never in there, so the export is safe to share.
  const exportAll = () => {
    const data = Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith(STORE_PREFIX)).map((k) => [k, JSON.parse(localStorage.getItem(k)!)]));
    downloadFile(`shellmoor-settings-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ app: 'shellmoor', version: 1, data }, null, 2));
    toast('Settings exported', { tone: 'success', description: 'Themes, profiles, hosts, layouts, projects and preferences.' });
  };

  const importFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed?.app !== 'shellmoor' || typeof parsed.data !== 'object') throw new Error('Not a Shellmoor settings file');
      const keys = Object.keys(parsed.data).filter((k) => k.startsWith(STORE_PREFIX));
      if (!(await confirm({ title: 'Import settings?', message: `Replaces ${keys.length} groups of settings with the ones in “${file.name}”. Shellmoor will reload.`, confirmLabel: 'Import' }))) return;
      keys.forEach((k) => localStorage.setItem(k, JSON.stringify(parsed.data[k])));
      location.reload();
    } catch (e) {
      toast('Couldn’t import settings', { tone: 'danger', description: (e as Error).message });
    }
  };

  const resetAll = async () => {
    if (!(await confirm({ title: 'Reset all settings?', message: 'Themes, profiles, hosts, layouts, projects and preferences go back to defaults. Shellmoor will reload.', confirmLabel: 'Reset', destructive: true }))) return;
    Object.keys(localStorage).filter((k) => k.startsWith(STORE_PREFIX)).forEach((k) => localStorage.removeItem(k));
    location.reload();
  };

  return (
    <>
      <Title>General</Title>
      <Group title="Startup">
        <GroupRow label="Reopen last session" hint="Restores your tabs and splits. Processes start fresh.">
          <Toggle on={s.restoreSession} onChange={(restoreSession) => s.set({ restoreSession })} />
        </GroupRow>
        <GroupRow label="Confirm before quitting" hint="When terminals are still running">
          <Toggle on={s.confirmQuitWithSessions} onChange={(confirmQuitWithSessions) => s.set({ confirmQuitWithSessions })} />
        </GroupRow>
      </Group>
      <Group title="Projects">
        <GroupRow label="Default location" hint="Where new projects are created">
          <input value={s.defaultProjectFolder} onChange={(e) => s.set({ defaultProjectFolder: e.target.value })} className={`${field} !w-52 font-mono text-xs`} />
          <Button onClick={async () => { const f = await pickFolder(); if (f) s.set({ defaultProjectFolder: f }); }}>Choose…</Button>
        </GroupRow>
      </Group>
      <Group title="Settings file" footer="Exports never include passwords or API keys; those stay in your system keychain.">
        <GroupRow label="Export settings" hint="Move your setup to another computer">
          <Button icon={Download} onClick={exportAll}>Export…</Button>
        </GroupRow>
        <GroupRow label="Import settings">
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
          <Button icon={Upload} onClick={() => fileRef.current?.click()}>Import…</Button>
        </GroupRow>
        <GroupRow label="Reset everything">
          <Button variant="danger" icon={RotateCcw} onClick={resetAll}>Reset…</Button>
        </GroupRow>
      </Group>
    </>
  );
}

// ---------- Appearance ----------

// A miniature window drawn in the theme's own colours.
function ThemePreview({ t }: { t: Theme }) {
  return (
    <div className="aspect-[16/10] overflow-hidden rounded-[9px] shadow-[0_1px_3px_rgb(0_0_0/0.25)]" style={{ background: t.surface }}>
      <div className="flex gap-[3px] px-2 py-1.5">
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => <span key={c} className="h-[5px] w-[5px] rounded-full" style={{ background: c }} />)}
      </div>
      <div className="mx-1.5 h-full space-y-[5px] rounded-t-[5px] px-2 pt-2" style={{ background: t.bg }}>
        <div className="flex gap-1">
          <span className="h-[5px] w-5 rounded-full" style={{ background: t.accent }} />
          <span className="h-[5px] w-9 rounded-full" style={{ background: t.text, opacity: 0.6 }} />
        </div>
        <div className="flex gap-1">
          <span className="h-[5px] w-3 rounded-full" style={{ background: t.ansi[5] }} />
          <span className="h-[5px] w-8 rounded-full" style={{ background: t.ansi[2] }} />
          <span className="h-[5px] w-4 rounded-full" style={{ background: t.ansi[3] }} />
        </div>
        <div className="flex gap-1">
          <span className="h-[5px] w-6 rounded-full" style={{ background: t.muted }} />
          <span className="h-[5px] w-3 rounded-full" style={{ background: t.ansi[4] }} />
        </div>
      </div>
    </div>
  );
}

function Appearance() {
  const { themeId, setTheme, setPreview } = useTheme();
  const { uiScale, set } = useSettings();
  const [filter, setFilter] = useState<'all' | 'dark' | 'light'>('all');
  const [query, setQuery] = useState('');
  const shown = themes.filter((t) => (filter === 'all' || t.type === filter) && t.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <Title action={<Button icon={Shuffle} onClick={() => shown.length && setTheme(shown[Math.floor(Math.random() * shown.length)].id)}>Shuffle</Button>}>
        Appearance
      </Title>
      <Group>
        <GroupRow label="Text size" hint="Scales the whole interface. Terminal and editor fonts have their own size.">
          <Segmented
            value={String(uiScale)}
            onChange={(v) => set({ uiScale: Number(v) })}
            options={[{ value: '1', label: 'Small' }, { value: '1.1', label: 'Default' }, { value: '1.25', label: 'Large' }, { value: '1.4', label: 'Larger' }]}
          />
        </GroupRow>
      </Group>
      <div className="mb-5 flex items-center gap-3">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[{ value: 'all', label: 'All' }, { value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]}
        />
        <input placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} className={`${field} max-w-52`} />
        <span className="flex-1" />
        <span className="text-[11px] text-muted">Hover to preview</span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-x-4 gap-y-5" onMouseLeave={() => setPreview(null)}>
        {shown.map((t) => {
          const selected = t.id === themeId;
          return (
            <button key={t.id} onMouseEnter={() => setPreview(t.id)} onClick={() => setTheme(t.id)} className="group text-center">
              <div className={cx('rounded-[12px] p-[3px] transition', selected ? 'ring-[3px] ring-accent' : 'ring-[3px] ring-transparent group-hover:ring-text/15')}>
                <ThemePreview t={t} />
              </div>
              <div className={cx('mt-2 flex items-center justify-center gap-1 text-xs', selected ? 'font-semibold text-text' : 'text-muted group-hover:text-text')}>
                {t.name}
                {selected && <Check size={11} strokeWidth={3} className="text-accent" />}
              </div>
            </button>
          );
        })}
      </div>
      {shown.length === 0 && <p className="py-10 text-center text-muted">No Results</p>}
    </>
  );
}

// ---------- Profiles ----------

const fonts = ['JetBrains Mono Variable', 'Consolas', 'Cascadia Code', 'Cascadia Mono', 'JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', 'SF Mono', 'Source Code Pro', 'Ubuntu Mono'];

function Profiles() {
  const { profiles, defaultId, add, duplicate, update, remove, setDefault } = useProfiles();
  const addTab = useWorkspace((s) => s.addTab);
  const close = useUi((s) => s.close);
  const [selectedId, setSelectedId] = useState(defaultId);
  const p = profiles.find((x) => x.id === selectedId) ?? profiles[0];
  const set = (patch: Parameters<typeof update>[1]) => update(p.id, patch);

  const onDelete = async () => {
    if (await confirm({ title: `Delete “${p.name}”?`, message: 'Open terminals using it switch to the default profile.', confirmLabel: 'Delete', destructive: true })) remove(p.id);
  };

  return (
    <>
      <Title action={<Button variant="primary" onClick={() => (addTab('terminal', p.id), close())}>Open {p.name}</Button>}>Profiles</Title>

      {/* Profile picker as a row of chips, with add/duplicate/delete at the end. */}
      <div className="mb-6 flex flex-wrap items-center gap-1.5">
        {profiles.map((x) => (
          <button
            key={x.id}
            onClick={() => setSelectedId(x.id)}
            className={cx('flex h-7 items-center gap-2 rounded-full px-3 transition', x.id === p.id ? 'bg-text/14 text-text' : 'text-muted hover:bg-text/7 hover:text-text')}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: x.color }} />
            {x.name}
            {x.id === defaultId && <span className="text-[10px] font-semibold uppercase text-muted">default</span>}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        <IconButton icon={Plus} label="New profile" className="!rounded-full" onClick={() => setSelectedId(add())} />
        <IconButton icon={Copy} label="Duplicate" className="!rounded-full" onClick={() => setSelectedId(duplicate(p.id))} />
        <IconButton icon={Trash} label="Delete" className="!rounded-full" disabled={profiles.length === 1} onClick={onDelete} />
      </div>

      <Group>
        <GroupRow label="Name">
          <input value={p.name} onChange={(e) => set({ name: e.target.value })} className={control} />
        </GroupRow>
        <GroupRow label="Colour" hint="Shown in tabs, menus and the sidebar">
          <label className="relative h-6 w-10 cursor-pointer rounded-full shadow-inner ring-1 ring-border" style={{ background: p.color }}>
            <input type="color" value={p.color} onChange={(e) => set({ color: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" />
          </label>
        </GroupRow>
        <GroupRow label="Default profile" hint={`Used by New Tab (${keyLabel('KeyT')})`}>
          <Toggle on={p.id === defaultId} onChange={() => setDefault(p.id)} disabled={p.id === defaultId} />
        </GroupRow>
      </Group>

      <Group title="Shell" footer="Shell settings take effect once the backend runs separate sessions.">
        <GroupRow label="Command">
          <input list="shell-suggestions" value={p.shell} onChange={(e) => set({ shell: e.target.value })} className={`${control} font-mono text-xs`} />
          <datalist id="shell-suggestions">{shellSuggestions.map((s) => <option key={s} value={s} />)}</datalist>
        </GroupRow>
        <GroupRow label="Arguments">
          <input value={p.args} onChange={(e) => set({ args: e.target.value })} className={`${control} font-mono text-xs`} />
        </GroupRow>
        <GroupRow label="Starting folder" hint="A project’s folder takes precedence">
          <input value={p.cwd} onChange={(e) => set({ cwd: e.target.value })} className={`${control} font-mono text-xs`} />
        </GroupRow>
        <GroupRow label="Environment" hint="One KEY=value per line">
          <textarea rows={2} value={p.env} onChange={(e) => set({ env: e.target.value })} placeholder="NODE_ENV=development" className={`${control} h-auto resize-y py-1.5 font-mono text-xs`} />
        </GroupRow>
      </Group>

      <Group title="Text" footer="Changes apply live to open terminals.">
        <GroupRow label="Theme">
          <select value={p.themeId ?? ''} onChange={(e) => set({ themeId: e.target.value || null })} className={control}>
            <option value="">Same as app</option>
            {themes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </GroupRow>
        <GroupRow label="Font">
          <input list="font-suggestions" value={p.fontFamily} onChange={(e) => set({ fontFamily: e.target.value })} className={control} />
          <datalist id="font-suggestions">{fonts.map((f) => <option key={f} value={f} />)}</datalist>
        </GroupRow>
        <GroupRow label="Size">
          <input type="range" min={9} max={28} value={p.fontSize} onChange={(e) => set({ fontSize: Number(e.target.value) })} className="w-48 accent-[var(--color-accent)]" />
          <span className="w-10 text-right tabular-nums text-muted">{p.fontSize} pt</span>
        </GroupRow>
        <GroupRow label="Cursor">
          <Segmented<CursorStyle>
            value={p.cursorStyle}
            onChange={(cursorStyle) => set({ cursorStyle })}
            options={[{ value: 'block', label: 'Block' }, { value: 'bar', label: 'Bar' }, { value: 'underline', label: 'Underline' }]}
          />
        </GroupRow>
        <GroupRow label="Blinking cursor">
          <Toggle on={p.cursorBlink} onChange={(cursorBlink) => set({ cursorBlink })} />
        </GroupRow>
      </Group>
    </>
  );
}

// ---------- Terminal ----------

function TerminalSettings() {
  const s = useSettings();
  return (
    <>
      <Title>Terminal</Title>
      <Group footer="Scrollback applies to new terminals.">
        <GroupRow label="Scrollback" hint="Lines kept per terminal">
          <select value={s.scrollback} onChange={(e) => s.set({ scrollback: Number(e.target.value) })} className={`${field} !w-36`}>
            {[1000, 5000, 10000, 50000, 100000].map((n) => <option key={n} value={n}>{n.toLocaleString()} lines</option>)}
          </select>
        </GroupRow>
        <GroupRow label="Copy on select">
          <Toggle on={s.copyOnSelect} onChange={(copyOnSelect) => s.set({ copyOnSelect })} />
        </GroupRow>
        <GroupRow label="Right-click">
          <Segmented value={s.rightClick} onChange={(rightClick) => s.set({ rightClick })} options={[{ value: 'menu', label: 'Show Menu' }, { value: 'paste', label: 'Paste' }]} />
        </GroupRow>
        <GroupRow label="Bell">
          <Segmented value={s.bell} onChange={(bell) => s.set({ bell })} options={[{ value: 'none', label: 'Off' }, { value: 'visual', label: 'Flash' }, { value: 'sound', label: 'Sound' }]} />
        </GroupRow>
      </Group>
      <Group title="Session logs" footer="Logs are plain text files. Older logs are deleted automatically.">
        <GroupRow label="Save terminal output" hint="Writes each session to a log file">
          <Toggle on={s.logging} onChange={(logging) => s.set({ logging })} />
        </GroupRow>
        <GroupRow label="Keep logs for">
          <select disabled={!s.logging} value={s.logRetentionDays} onChange={(e) => s.set({ logRetentionDays: Number(e.target.value) })} className={`${field} !w-36 disabled:opacity-50`}>
            {[1, 7, 14, 30, 90, 365].map((d) => <option key={d} value={d}>{d === 1 ? '1 day' : `${d} days`}</option>)}
          </select>
        </GroupRow>
        <GroupRow label="Folder">
          <input disabled={!s.logging} value={s.logFolder} onChange={(e) => s.set({ logFolder: e.target.value })} className={`${field} !w-52 font-mono text-xs disabled:opacity-50`} />
          <Button disabled={!s.logging} onClick={async () => { const f = await pickFolder('Choose Log Folder'); if (f) s.set({ logFolder: f }); }}>Choose…</Button>
        </GroupRow>
      </Group>
    </>
  );
}

// ---------- Notifications ----------

function Notifications() {
  const s = useSettings();
  return (
    <>
      <Title action={<Button onClick={() => notify('Shellmoor', 'npm run build finished in 42 s')}>Send Test</Button>}>Notifications</Title>
      <Group footer="Useful for builds, deploys and test runs you leave running.">
        <GroupRow label="Notify when a command finishes">
          <Toggle on={s.notifyOnFinish} onChange={(notifyOnFinish) => s.set({ notifyOnFinish })} />
        </GroupRow>
        <GroupRow label="Only if it ran longer than">
          <select disabled={!s.notifyOnFinish} value={s.notifyAfterSeconds} onChange={(e) => s.set({ notifyAfterSeconds: Number(e.target.value) })} className={`${field} !w-36 disabled:opacity-50`}>
            {[5, 10, 30, 60, 300].map((n) => <option key={n} value={n}>{n < 60 ? `${n} seconds` : `${n / 60} minute${n > 60 ? 's' : ''}`}</option>)}
          </select>
        </GroupRow>
        <GroupRow label="Only when Shellmoor is in the background">
          <Toggle disabled={!s.notifyOnFinish} on={s.notifyOnlyInBackground} onChange={(notifyOnlyInBackground) => s.set({ notifyOnlyInBackground })} />
        </GroupRow>
      </Group>
    </>
  );
}

// ---------- Privacy & Security ----------

function Security() {
  const s = useSettings();
  const add = async () => {
    const folder = (await pickFolder('Allow Folder')) ?? (await prompt({ title: 'Allow Folder', message: 'Shellmoor’s file features may read and write inside this folder.', placeholder: '~/projects', confirmLabel: 'Allow' }));
    if (folder && !s.allowedPaths.includes(folder)) s.set({ allowedPaths: [...s.allowedPaths, folder] });
  };
  return (
    <>
      <Title>Privacy &amp; Security</Title>
      <Group title="Folder access" footer="The file explorer, editor and previews only work inside these folders. Terminals are not restricted: they run as you.">
        {s.allowedPaths.map((p) => (
          <div key={p} className="flex min-h-10 items-center gap-2 py-1.5">
            <Lock size={13} className="text-muted" />
            <span className="flex-1 truncate font-mono text-xs">{p}</span>
            <IconButton icon={X} size={13} label="Remove" onClick={() => s.set({ allowedPaths: s.allowedPaths.filter((x) => x !== p) })} />
          </div>
        ))}
        <div className="py-2">
          <Button variant="ghost" icon={Plus} onClick={add}>Allow Folder…</Button>
        </div>
      </Group>
      <Group title="Network">
        <GroupRow label="No listening ports" hint="Shellmoor never opens a network port. The UI talks to its backend in-process.">
          <Check size={16} className="text-success" />
        </GroupRow>
        <GroupRow label="Secrets" hint="Passwords and API keys are stored in your system keychain">
          <Check size={16} className="text-success" />
        </GroupRow>
      </Group>
    </>
  );
}

// ---------- AI ----------

const providers: { value: AiProvider; label: string; needsKey: boolean; endpoint: boolean }[] = [
  { value: 'anthropic', label: 'Anthropic', needsKey: true, endpoint: false },
  { value: 'openai', label: 'OpenAI', needsKey: true, endpoint: false },
  { value: 'ollama', label: 'Ollama (local)', needsKey: false, endpoint: true },
  { value: 'custom', label: 'Custom (OpenAI-compatible)', needsKey: true, endpoint: true },
];

function Ai() {
  const s = useSettings();
  const [key, setKey] = useState('');
  const provider = providers.find((p) => p.value === s.aiProvider)!;

  const saveKey = async () => {
    await saveSecret(`ai:${s.aiProvider}`, key.trim());
    setKey('');
    s.set({ aiKeyConfigured: true });
    toast('API key saved', { tone: 'success', description: 'Stored in your system keychain.' });
  };

  return (
    <>
      <Title>AI Assistant</Title>
      <Group footer="Optional. Every Shellmoor feature works without AI or an account.">
        <GroupRow label="Enable AI assistant" hint="Explain errors, generate commands, summarise diffs">
          <Toggle on={s.aiEnabled} onChange={(aiEnabled) => s.set({ aiEnabled })} />
        </GroupRow>
      </Group>
      <div className={cx(!s.aiEnabled && 'pointer-events-none opacity-45')}>
        <Group title="Provider">
          <GroupRow label="Service">
            <select value={s.aiProvider} onChange={(e) => s.set({ aiProvider: e.target.value as AiProvider, aiKeyConfigured: false })} className={control}>
              {providers.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </GroupRow>
          <GroupRow label="Model">
            <input value={s.aiModel} onChange={(e) => s.set({ aiModel: e.target.value })} className={`${control} font-mono text-xs`} />
          </GroupRow>
          {provider.endpoint && (
            <GroupRow label="Endpoint">
              <input value={s.aiEndpoint} onChange={(e) => s.set({ aiEndpoint: e.target.value })} placeholder="http://localhost:11434" className={`${control} font-mono text-xs`} />
            </GroupRow>
          )}
          {provider.needsKey && (
            <GroupRow label="API key" hint={s.aiKeyConfigured ? 'Saved in your keychain' : 'Your own key; billed by the provider'}>
              {s.aiKeyConfigured ? (
                <>
                  <span className="flex items-center gap-1.5 text-success"><Check size={14} /> Configured</span>
                  <Button variant="danger" onClick={async () => (await deleteSecret(`ai:${s.aiProvider}`), s.set({ aiKeyConfigured: false }))}>Remove</Button>
                </>
              ) : (
                <>
                  <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-…" className={`${field} !w-48`} />
                  <Button variant="primary" disabled={!key.trim()} onClick={saveKey}>Save</Button>
                </>
              )}
            </GroupRow>
          )}
        </Group>
        <Group title="Context" footer="Only what you allow here is sent with your questions.">
          <GroupRow label="Share terminal output" hint="Recent output of the focused terminal">
            <Toggle on={s.aiShareTerminal} onChange={(aiShareTerminal) => s.set({ aiShareTerminal })} />
          </GroupRow>
          <GroupRow label="Share open files" hint="Files you select in the editor">
            <Toggle on={s.aiShareFiles} onChange={(aiShareFiles) => s.set({ aiShareFiles })} />
          </GroupRow>
          <GroupRow label="Confirm before running commands" hint="Suggested commands never run without your approval">
            <span className="text-muted">Always</span>
          </GroupRow>
        </Group>
      </div>
    </>
  );
}

// ---------- Extensions ----------

function Extensions() {
  const { extensions, disabledTools, setEnabled, remove, setToolEnabled } = useExtensions();
  const tools = (Object.entries(panels) as [PanelKind, (typeof panels)[PanelKind]][]).filter(([k]) => k !== 'terminal' && k !== 'extension');
  const close = useUi((s) => s.close);

  const installFromFolder = async () => {
    const folder = await pickFolder('Choose Extension Folder');
    if (!folder) return;
    await readExtensionFolder(folder); // backend reads and validates manifest.json; then install() it
  };

  const onRemove = async (id: string, name: string) => {
    if (await confirm({ title: `Remove ${name}?`, message: 'Open panes showing it will close their content.', confirmLabel: 'Remove', destructive: true })) remove(id);
  };

  return (
    <>
      <Title action={<Button icon={Plus} onClick={installFromFolder}>Install from Folder…</Button>}>Extensions</Title>

      <Group title="Built-in tools" footer="Turned-off tools disappear from the sidebar and command palette. Terminals are always on.">
        {tools.map(([kind, p]) => (
          <GroupRow key={kind} label={p.label}>
            <Toggle on={!disabledTools.includes(kind)} onChange={(on) => setToolEnabled(kind, on)} />
          </GroupRow>
        ))}
      </Group>

      <Group
        title="Installed"
        footer="Extensions run in a sandbox. They can’t read your files, terminals, keys or settings; they only receive theme colours and can show notifications."
      >
        {extensions.length === 0 && <div className="py-4 text-center text-muted">No extensions installed.</div>}
        {extensions.map((x) => (
          <div key={x.id} className="flex min-h-14 items-center gap-3 py-2">
            <Tile icon={Puzzle} color="#ff9f0a" size={28} />
            <div className="min-w-0 flex-1">
              <div className="text-text">
                {x.name} <span className="text-[11px] text-muted">{x.version} · {x.author}</span>
              </div>
              <div className="truncate text-[11px] text-muted">{x.description}</div>
            </div>
            <Button variant="ghost" disabled={!x.enabled} onClick={() => (useWorkspace.getState().openTool('extension', { extensionId: x.id }), close())}>Open</Button>
            <IconButton icon={Trash} size={13} label="Remove" onClick={() => onRemove(x.id, x.name)} />
            <Toggle on={x.enabled} onChange={(on) => setEnabled(x.id, on)} />
          </div>
        ))}
      </Group>
    </>
  );
}

// ---------- Keyboard ----------

// Click a shortcut, press a key: the platform modifier (⌘ / Ctrl+Shift, or Alt for pane focus) stays fixed.
function ShortcutButton({ command, conflict }: { command: Command; conflict: boolean }) {
  const { keymap, set } = useSettings();
  const [recording, setRecording] = useState(false);
  const code = keyFor(command)!;

  useEffect(() => {
    if (!recording) return;
    keyboard.recording = true;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return; // wait for the actual key
      if (e.key !== 'Escape') set({ keymap: { ...keymap, [command.id]: e.code } });
      setRecording(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      keyboard.recording = false;
      window.removeEventListener('keydown', onKey, true);
    };
  }, [recording, command.id, keymap, set]);

  return (
    <button
      onClick={() => setRecording(true)}
      title="Click, then press a key. Esc cancels."
      className={cx('rounded-md px-2 py-0.5 text-[11px] transition', recording ? 'bg-accent text-bg' : conflict ? 'bg-danger/15 text-danger' : 'bg-text/8 text-muted hover:bg-text/14 hover:text-text')}
    >
      {recording ? 'Press a key…' : keyLabel(code, command.alt)}
    </button>
  );
}

function Shortcuts() {
  const { keymap, set } = useSettings();
  const commands = getCommands().filter((c) => c.key && !c.id.startsWith('tab-'));
  const groups = [...new Set(commands.map((c) => c.group))];
  // Two commands on the same key and modifier would both claim it.
  const used = new Map<string, number>();
  commands.forEach((c) => used.set(`${c.alt}:${keyFor(c)}`, (used.get(`${c.alt}:${keyFor(c)}`) ?? 0) + 1));

  return (
    <>
      <Title action={Object.keys(keymap).length > 0 && <Button icon={RotateCcw} onClick={() => set({ keymap: {} })}>Restore Defaults</Button>}>Keyboard</Title>
      <p className="-mt-3 mb-5 text-muted">
        {isMac ? 'Shortcuts use ⌘.' : 'Shortcuts use Ctrl+Shift so plain Ctrl keys still reach your shell.'} Click a shortcut to change its key.
      </p>
      {groups.map((g) => (
        <Group key={g} title={g}>
          {commands.filter((c) => c.group === g).map((c) => (
            <GroupRow key={c.id} label={c.title}>
              {keymap[c.id] && (
                <IconButton
                  icon={RotateCcw}
                  size={12}
                  label="Use default"
                  className="!h-6 !w-6"
                  onClick={() => set({ keymap: Object.fromEntries(Object.entries(keymap).filter(([id]) => id !== c.id)) })}
                />
              )}
              <ShortcutButton command={c} conflict={(used.get(`${c.alt}:${keyFor(c)}`) ?? 0) > 1} />
            </GroupRow>
          ))}
        </Group>
      ))}
      <Group title="Fixed">
        <GroupRow label="Go to Tab 1–9"><Kbd>{keyLabel('Digit1').replace('1', '1–9')}</Kbd></GroupRow>
        <GroupRow label="Command Palette"><Kbd>{keyLabel('KeyP')}</Kbd></GroupRow>
      </Group>
    </>
  );
}

// ---------- About ----------

function About() {
  return (
    <div className="flex h-full flex-col items-center justify-center pb-10 text-center">
      <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-[26px] bg-gradient-to-b from-accent to-[color-mix(in_oklab,var(--color-accent)_60%,black)] text-bg shadow-[0_10px_30px_-8px_var(--color-accent)]">
        <SquareTerminal size={50} strokeWidth={1.5} />
      </div>
      <h2 className="text-[26px] font-bold tracking-tight text-text">Shellmoor</h2>
      <p className="mt-1 text-muted">Version 0.1.0 (Preview)</p>
      <p className="mt-5 max-w-sm leading-relaxed text-muted">
        One window for your terminals, code, servers, containers and clusters. Works fully offline. No account or AI key required.
      </p>
    </div>
  );
}

const views: Record<SettingsSection, () => ReactNode> = {
  general: General, appearance: Appearance, profiles: Profiles, terminal: TerminalSettings, notifications: Notifications,
  security: Security, ai: Ai, extensions: Extensions, shortcuts: Shortcuts, about: About,
};

export default function Settings() {
  const sheet = useUi((s) => s.sheet);
  const close = useUi((s) => s.close);
  if (sheet?.type !== 'settings') return null;
  const View = views[sheet.section];

  return (
    <div className="fixed inset-0 z-50 flex animate-fade items-center justify-center bg-black/25" onMouseDown={close}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="flex h-[min(680px,90vh)] w-[min(920px,94vw)] animate-pop overflow-hidden rounded-[20px] bg-bg shadow-[0_30px_80px_-20px_rgb(0_0_0/0.6)] ring-1 ring-border"
      >
        <nav className="glass m-2 mr-0 flex w-56 shrink-0 flex-col gap-0.5 overflow-y-auto rounded-[14px] !shadow-none">
          <div className="flex h-12 shrink-0 items-center px-2">
            <IconButton icon={X} label="Close (Esc)" className="!rounded-full" onClick={close} />
          </div>
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => openSettings(s.id)}
              className={cx('mx-2 flex h-8 shrink-0 items-center gap-2.5 rounded-lg px-2 text-left', sheet.section === s.id ? 'bg-text/12' : 'hover:bg-text/6')}
            >
              <Tile icon={s.icon} color={s.color} />
              {s.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 flex-1 overflow-y-auto px-8 py-6">
          <View />
        </div>
      </div>
    </div>
  );
}
