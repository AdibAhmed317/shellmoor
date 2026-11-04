// The non-settings sheets: project switcher, new project, layouts, command history and the host editor.
import { useMemo, useState } from 'react';
import {
  Bookmark, Check, CircleCheck, CircleX, Columns2, Copy, FolderOpen, FolderPlus, PanelLeft, Plus, Search, SquareTerminal, Star, Trash, X,
} from 'lucide-react';
import { useUi } from '../store/ui';
import { useProjects } from '../store/projects';
import { applyLayout, builtInLayouts, useLayouts, type Layout } from '../store/layouts';
import { useWorkspace, type LayoutNode, type Snapshot } from '../store/workspace';
import { formatAgo, formatDuration, useHistory } from '../store/history';
import { address, blankHost, useHosts, type Forward, type Host } from '../store/hosts';
import { useSettings } from '../store/settings';
import { useTheme } from '../store/theme';
import { confirm, prompt, toast } from '../store/overlays';
import { copyText, pickFile, pickFolder, saveSecret } from '../backend';
import { panels } from '../panels/registry';
import { terminals } from './Terminal';
import { keyLabel } from '../commands';
import { Badge, Button, Group, GroupRow, IconButton, Kbd, Segmented, Sheet, Toggle, cx, field } from '../ui';

// ---------- Layout thumbnails ----------

function ThumbNode({ node }: { node: LayoutNode }) {
  if (node.type === 'panel') {
    const Icon = panels[node.kind].icon;
    return (
      <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center rounded-[3px] bg-text/12 text-muted">
        <Icon size={11} strokeWidth={2} />
      </div>
    );
  }
  return (
    <div className={cx('flex min-h-0 min-w-0 flex-1 gap-[3px]', node.direction === 'horizontal' ? 'flex-row' : 'flex-col')}>
      {node.children.map((c) => <ThumbNode key={c.id} node={c} />)}
    </div>
  );
}

// A miniature of a layout's first tab, with a count of any further tabs.
export function LayoutThumb({ snapshot, className }: { snapshot: Snapshot; className?: string }) {
  return (
    <div className={cx('relative flex aspect-[16/10] rounded-lg bg-text/5 p-[5px]', className)}>
      <ThumbNode node={snapshot.tabs[0].root} />
      {snapshot.tabs.length > 1 && (
        <span className="absolute bottom-1 right-1 rounded bg-bg/80 px-1 text-[10px] font-semibold text-muted">+{snapshot.tabs.length - 1} tab</span>
      )}
    </div>
  );
}

// ---------- Project switcher (Spotlight-style) ----------

function ProjectSwitcher() {
  const close = useUi((s) => s.close);
  const open = useUi((s) => s.open);
  const { projects, currentId, switchTo, update, remove } = useProjects();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);

  const q = query.trim().toLowerCase();
  const matches = projects.filter((p) => !q || p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q));
  const pinned = matches.filter((p) => p.pinned).sort((a, b) => a.name.localeCompare(b.name));
  const recent = matches.filter((p) => !p.pinned).sort((a, b) => b.lastOpened - a.lastOpened);
  const ordered = [...pinned, ...recent];
  const current = ordered[Math.min(index, ordered.length - 1)];

  const choose = (id: string) => (switchTo(id), close());
  const onRemove = async (id: string, name: string) => {
    if (await confirm({ title: `Remove “${name}”?`, message: 'The project leaves Shellmoor. Files on disk are not touched.', confirmLabel: 'Remove', destructive: true })) remove(id);
  };

  const row = (p: (typeof projects)[number]) => (
    <div
      key={p.id}
      onMouseMove={() => setIndex(ordered.indexOf(p))}
      onClick={() => choose(p.id)}
      className={cx('group flex h-11 items-center gap-3 rounded-[10px] px-3', p === current ? 'bg-accent text-bg' : 'text-text')}
    >
      <span className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', p === current ? 'bg-bg/20' : 'bg-accent/15 text-accent')}>
        <FolderOpen size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{p.name}</div>
        <div className={cx('truncate text-[11px]', p === current ? 'opacity-75' : 'text-muted')}>{p.path}</div>
      </div>
      {p.id === currentId && <Check size={14} />}
      <button
        title={p.pinned ? 'Unpin' : 'Pin'}
        onClick={(e) => (e.stopPropagation(), update(p.id, { pinned: !p.pinned }))}
        className={cx('rounded p-1', p.pinned ? '' : 'opacity-0 group-hover:opacity-70')}
      >
        <Star size={13} className={p.pinned ? 'fill-current' : ''} />
      </button>
      {p.id !== currentId && (
        <button title="Remove from list" onClick={(e) => (e.stopPropagation(), onRemove(p.id, p.name))} className="rounded p-1 opacity-0 group-hover:opacity-70">
          <X size={13} />
        </button>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex animate-fade justify-center bg-black/20 pt-[14vh]" onMouseDown={close}>
      <div onMouseDown={(e) => e.stopPropagation()} className="glass flex h-fit max-h-[62vh] w-[min(560px,92vw)] animate-pop flex-col overflow-hidden rounded-[22px]">
        <div className="flex items-center gap-3 px-5">
          <FolderOpen size={20} strokeWidth={1.75} className="text-muted" />
          <input
            autoFocus
            value={query}
            placeholder="Switch project"
            onChange={(e) => (setQuery(e.target.value), setIndex(0))}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') setIndex((i) => Math.min(i + 1, ordered.length - 1));
              else if (e.key === 'ArrowUp') setIndex((i) => Math.max(i - 1, 0));
              else if (e.key === 'Enter' && current) choose(current.id);
              else return;
              e.preventDefault();
            }}
            className="h-14 flex-1 bg-transparent text-[20px] tracking-tight text-text outline-none placeholder:text-muted/60"
          />
        </div>
        <div className="min-h-0 overflow-y-auto border-t border-border px-2 pb-2">
          {pinned.length > 0 && <div className="px-3 pb-1 pt-3 text-[11px] font-semibold text-muted">Pinned</div>}
          {pinned.map(row)}
          {recent.length > 0 && <div className="px-3 pb-1 pt-3 text-[11px] font-semibold text-muted">Recent</div>}
          {recent.map(row)}
          {ordered.length === 0 && <div className="py-8 text-center text-muted">No projects match.</div>}
        </div>
        <div className="flex items-center gap-3 border-t border-border px-4 py-2">
          <Button variant="ghost" icon={FolderPlus} onClick={() => open({ type: 'newProject' })}>
            New Project…
          </Button>
          <span className="flex-1" />
          <span className="text-[11px] text-muted">Your tabs are saved per project</span>
        </div>
      </div>
    </div>
  );
}

// ---------- New project ----------

function LayoutPicker({ layouts, value, onChange }: { layouts: Layout[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
      {layouts.map((l) => (
        <button key={l.id} onClick={() => onChange(l.id)} className="group text-left">
          <div className={cx('rounded-[12px] p-[3px] ring-[3px] transition', l.id === value ? 'ring-accent' : 'ring-transparent group-hover:ring-text/15')}>
            <LayoutThumb snapshot={l.snapshot} />
          </div>
          <div className="mt-1.5 px-0.5 text-xs font-medium text-text">{l.name}</div>
          <div className="px-0.5 text-[11px] text-muted">{l.description}</div>
        </button>
      ))}
    </div>
  );
}

function NewProject() {
  const close = useUi((s) => s.close);
  const create = useProjects((s) => s.create);
  const saved = useLayouts((s) => s.saved);
  const defaultFolder = useSettings((s) => s.defaultProjectFolder);
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [layoutId, setLayoutId] = useState('blank');
  const layouts = [...builtInLayouts, ...saved];

  const browse = async () => {
    const folder = await pickFolder('Choose Project Folder');
    if (!folder) return;
    setPath(folder);
    if (!name) setName(folder.split(/[\\/]/).filter(Boolean).pop() ?? '');
  };
  const submit = () => {
    create({ name: name.trim(), path: path.trim() || `${defaultFolder}/${name.trim()}`, snapshot: layouts.find((l) => l.id === layoutId)!.snapshot });
    close();
    toast(`Opened project “${name.trim()}”`, { tone: 'success' });
  };

  return (
    <Sheet
      title="New Project"
      onClose={close}
      width="w-[min(680px,94vw)]"
      footer={
        <>
          <span className="flex-1 text-[11px] text-muted">Projects remember their tabs. Terminals start in the project folder.</span>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" disabled={!name.trim()} onClick={submit}>
            Create Project
          </Button>
        </>
      }
    >
      <Group>
        <GroupRow label="Name">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="my-app" className={`${field} !w-72`} />
        </GroupRow>
        <GroupRow label="Folder" hint={path ? undefined : `Defaults to ${defaultFolder}/<name>`}>
          <input value={path} onChange={(e) => setPath(e.target.value)} placeholder={`${defaultFolder}/${name || 'my-app'}`} className={`${field} !w-56 font-mono text-xs`} />
          <Button onClick={browse}>Choose…</Button>
        </GroupRow>
      </Group>
      <h3 className="mb-2 px-1 text-[13px] font-semibold">Start with</h3>
      <LayoutPicker layouts={layouts} value={layoutId} onChange={setLayoutId} />
    </Sheet>
  );
}

// ---------- Layouts ----------

function Layouts() {
  const close = useUi((s) => s.close);
  const { saved, saveCurrent, remove } = useLayouts();

  const apply = async (l: Layout) => {
    if (!(await confirm({ title: `Open “${l.name}”?`, message: 'Your current tabs will be replaced. Running sessions in them will end.', confirmLabel: 'Open Layout' }))) return;
    applyLayout(l);
    close();
  };
  const save = async () => {
    const name = await prompt({ title: 'Save Layout', message: 'Saves your tabs and splits so you can restore them later.', placeholder: 'Layout name', confirmLabel: 'Save' });
    if (name) (saveCurrent(name), toast(`Saved layout “${name}”`, { tone: 'success' }));
  };

  const card = (l: Layout) => (
    <div key={l.id} className="group relative">
      <button onClick={() => apply(l)} className="w-full text-left">
        <div className="rounded-[12px] p-[3px] ring-[3px] ring-transparent transition group-hover:ring-accent/60">
          <LayoutThumb snapshot={l.snapshot} />
        </div>
        <div className="mt-1.5 px-0.5 text-xs font-medium">{l.name}</div>
        <div className="px-0.5 text-[11px] text-muted">{l.description}</div>
      </button>
      {!l.builtIn && (
        <IconButton icon={Trash} size={13} label="Delete layout" className="!absolute right-2 top-2 !h-6 !w-6 bg-bg/80 opacity-0 group-hover:opacity-100" onClick={() => remove(l.id)} />
      )}
    </div>
  );

  return (
    <Sheet
      title="Layouts"
      onClose={close}
      width="w-[min(720px,94vw)]"
      footer={
        <>
          <Button icon={Bookmark} onClick={save}>Save Current Layout…</Button>
          <span className="flex-1" />
          <Button onClick={close}>Done</Button>
        </>
      }
    >
      <h3 className="mb-2 px-1 text-[13px] font-semibold">Saved</h3>
      {saved.length ? (
        <div className="mb-6 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">{saved.map(card)}</div>
      ) : (
        <p className="mb-6 rounded-xl bg-text/4 px-4 py-5 text-center text-muted">No saved layouts yet. Arrange your tabs, then choose Save Current Layout.</p>
      )}
      <h3 className="mb-2 px-1 text-[13px] font-semibold">Templates</h3>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">{builtInLayouts.map(card)}</div>
    </Sheet>
  );
}

// ---------- Command history ----------

function HistorySheet() {
  const close = useUi((s) => s.close);
  const entries = useHistory((s) => s.entries);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'failed'>('all');
  const [index, setIndex] = useState(0);

  const q = query.trim().toLowerCase();
  const shown = entries
    .filter((e) => (filter === 'all' || e.exitCode !== 0) && (!q || e.command.toLowerCase().includes(q) || e.cwd.toLowerCase().includes(q)))
    .sort((a, b) => b.at - a.at);
  const current = shown[Math.min(index, shown.length - 1)];

  // Inserts into the focused terminal without pressing Enter, so the user can edit before running.
  const insert = (command: string) => {
    const ws = useWorkspace.getState();
    const tab = ws.tabs.find((t) => t.id === ws.activeTabId)!;
    const term = terminals.get(tab.activePanelId);
    close();
    if (term) term.write(command);
    else (copyText(command), toast('Copied to clipboard', { description: 'Focus a terminal to insert commands directly.' }));
  };

  return (
    <div className="fixed inset-0 z-50 flex animate-fade justify-center bg-black/20 pt-[12vh]" onMouseDown={close}>
      <div onMouseDown={(e) => e.stopPropagation()} className="glass flex h-fit max-h-[66vh] w-[min(720px,94vw)] animate-pop flex-col overflow-hidden rounded-[22px]">
        <div className="flex items-center gap-3 px-5">
          <Search size={20} strokeWidth={1.75} className="text-muted" />
          <input
            autoFocus
            value={query}
            placeholder="Search command history"
            onChange={(e) => (setQuery(e.target.value), setIndex(0))}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') setIndex((i) => Math.min(i + 1, shown.length - 1));
              else if (e.key === 'ArrowUp') setIndex((i) => Math.max(i - 1, 0));
              else if (e.key === 'Enter' && current) insert(current.command);
              else return;
              e.preventDefault();
            }}
            className="h-14 flex-1 bg-transparent text-[20px] tracking-tight text-text outline-none placeholder:text-muted/60"
          />
          <Segmented value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'failed', label: 'Failed' }]} />
        </div>
        <div className="min-h-0 overflow-y-auto border-t border-border p-2">
          {shown.length === 0 && <div className="py-10 text-center text-muted">No commands match.</div>}
          {shown.map((e) => {
            const selected = e === current;
            const ok = e.exitCode === 0;
            return (
              <div
                key={e.id}
                onMouseMove={() => setIndex(shown.indexOf(e))}
                onClick={() => insert(e.command)}
                className={cx('group flex items-center gap-3 rounded-[10px] px-3 py-1.5', selected ? 'bg-accent text-bg' : 'text-text')}
              >
                {ok ? <CircleCheck size={14} className={selected ? '' : 'text-success'} /> : <CircleX size={14} className={selected ? '' : 'text-danger'} />}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-[12px]">{e.command}</div>
                  <div className={cx('truncate text-[11px]', selected ? 'opacity-75' : 'text-muted')}>
                    {e.cwd} · {formatDuration(e.durationMs)}
                    {!ok && ` · exit ${e.exitCode}`}
                  </div>
                </div>
                {e.host !== 'local' && <Badge tone={selected ? 'neutral' : 'accent'}>{e.host}</Badge>}
                <span className={cx('w-14 text-right text-[11px]', selected ? 'opacity-75' : 'text-muted')}>{formatAgo(e.at)}</span>
                <button
                  title="Copy"
                  onClick={(ev) => (ev.stopPropagation(), copyText(e.command), toast('Copied to clipboard'))}
                  className="rounded p-1 opacity-0 group-hover:opacity-80"
                >
                  <Copy size={13} />
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 border-t border-border px-4 py-1.5 text-[11px] text-muted">
          <span><Kbd>↵</Kbd> insert into terminal</span>
          <span className="flex-1" />
          <span>{keyLabel('KeyH')}</span>
        </div>
      </div>
    </div>
  );
}

// ---------- Host editor ----------

function HostEditor({ hostId }: { hostId: string | null }) {
  const close = useUi((s) => s.close);
  const { hosts, save, remove } = useHosts();
  const existing = hosts.find((h) => h.id === hostId);
  const [h, setH] = useState<Host>(() => existing ?? blankHost());
  const [password, setPassword] = useState(''); // never stored in app state; handed to the keychain seam
  const set = (patch: Partial<Host>) => setH((x) => ({ ...x, ...patch }));
  const groups = useMemo(() => [...new Set(hosts.map((x) => x.group))], [hosts]);
  const valid = h.name.trim() && h.hostname.trim() && h.user.trim() && h.port > 0;

  const setForward = (i: number, patch: Partial<Forward>) => set({ forwards: h.forwards.map((f, j) => (j === i ? { ...f, ...patch } : f)) });

  const submit = async () => {
    if (h.auth === 'password' && password) await saveSecret(`ssh:${h.id}`, password);
    save({ ...h, name: h.name.trim(), hostname: h.hostname.trim(), user: h.user.trim() });
    close();
    toast(existing ? `Saved ${h.name}` : `Added ${h.name}`, { tone: 'success', description: address(h) });
  };
  const onDelete = async () => {
    if (await confirm({ title: `Delete ${h.name}?`, message: 'The saved connection is removed. Nothing changes on the server.', confirmLabel: 'Delete', destructive: true })) {
      remove(h.id);
      close();
    }
  };

  return (
    <Sheet
      title={existing ? `Edit ${existing.name}` : 'Add Host'}
      onClose={close}
      width="w-[min(620px,94vw)]"
      footer={
        <>
          {existing && <Button variant="danger" icon={Trash} onClick={onDelete}>Delete</Button>}
          <span className="flex-1" />
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" disabled={!valid} onClick={submit}>{existing ? 'Save' : 'Add Host'}</Button>
        </>
      }
    >
      <Group>
        <GroupRow label="Name"><input autoFocus value={h.name} onChange={(e) => set({ name: e.target.value })} placeholder="prod-api" className={`${field} !w-64`} /></GroupRow>
        <GroupRow label="Group" hint="Production hosts get a red badge">
          <input list="host-groups" value={h.group} onChange={(e) => set({ group: e.target.value })} className={`${field} !w-64`} />
          <datalist id="host-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
        </GroupRow>
        <GroupRow label="Host"><input value={h.hostname} onChange={(e) => set({ hostname: e.target.value })} placeholder="10.0.0.5 or host.example.com" className={`${field} !w-64 font-mono text-xs`} /></GroupRow>
        <GroupRow label="User"><input value={h.user} onChange={(e) => set({ user: e.target.value })} placeholder="ubuntu" className={`${field} !w-64 font-mono text-xs`} /></GroupRow>
        <GroupRow label="Port"><input type="number" value={h.port} onChange={(e) => set({ port: Number(e.target.value) })} className={`${field} !w-24 font-mono text-xs`} /></GroupRow>
      </Group>

      <Group title="Authentication" footer={h.auth === 'password' ? 'Passwords are kept in your system keychain, never in Shellmoor’s settings.' : undefined}>
        <GroupRow label="Method">
          <Segmented value={h.auth} onChange={(auth) => set({ auth })} options={[{ value: 'agent', label: 'SSH Agent' }, { value: 'key', label: 'Key File' }, { value: 'password', label: 'Password' }]} />
        </GroupRow>
        {h.auth === 'key' && (
          <GroupRow label="Private key">
            <input value={h.keyPath} onChange={(e) => set({ keyPath: e.target.value })} placeholder="~/.ssh/id_ed25519" className={`${field} !w-52 font-mono text-xs`} />
            <Button onClick={async () => { const f = await pickFile('Choose Private Key'); if (f) set({ keyPath: f }); }}>Choose…</Button>
          </GroupRow>
        )}
        {h.auth === 'password' && (
          <GroupRow label="Password">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={existing ? 'Unchanged' : ''} className={`${field} !w-64`} />
          </GroupRow>
        )}
      </Group>

      <Group title="Connection">
        <GroupRow label="Jump host" hint="Connect through a bastion">
          <select value={h.jumpHost ?? ''} onChange={(e) => set({ jumpHost: e.target.value || null })} className={`${field} !w-64`}>
            <option value="">None</option>
            {hosts.filter((x) => x.id !== h.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </GroupRow>
        <GroupRow label="Keep alive" hint="Send keep-alive packets every 30 s"><Toggle on={h.keepAlive} onChange={(keepAlive) => set({ keepAlive })} /></GroupRow>
        <GroupRow label="Reconnect automatically" hint="After a temporary connection loss"><Toggle on={h.autoReconnect} onChange={(autoReconnect) => set({ autoReconnect })} /></GroupRow>
      </Group>

      <Group title="Port forwarding" footer="Local: reach a remote port on this computer. Remote: expose a local port on the server. Dynamic: SOCKS proxy.">
        {h.forwards.map((f, i) => (
          <div key={i} className="flex min-h-11 items-center gap-2 py-2">
            <select value={f.type} onChange={(e) => setForward(i, { type: e.target.value as Forward['type'] })} className={`${field} !w-28`}>
              <option value="local">Local</option>
              <option value="remote">Remote</option>
              <option value="dynamic">Dynamic</option>
            </select>
            <input type="number" value={f.bindPort} onChange={(e) => setForward(i, { bindPort: Number(e.target.value) })} className={`${field} !w-24 font-mono text-xs`} />
            <span className="text-muted">→</span>
            <input
              value={f.target}
              disabled={f.type === 'dynamic'}
              onChange={(e) => setForward(i, { target: e.target.value })}
              placeholder={f.type === 'dynamic' ? 'SOCKS5' : 'localhost:5432'}
              className={`${field} min-w-0 flex-1 font-mono text-xs disabled:opacity-50`}
            />
            <IconButton icon={X} size={13} label="Remove forward" onClick={() => set({ forwards: h.forwards.filter((_, j) => j !== i) })} />
          </div>
        ))}
        <div className="py-2">
          <Button variant="ghost" icon={Plus} onClick={() => set({ forwards: [...h.forwards, { type: 'local', bindPort: 8080, target: 'localhost:8080' }] })}>
            Add Forward
          </Button>
        </div>
      </Group>
    </Sheet>
  );
}

// ---------- Welcome (first launch) ----------

const tips = [
  { icon: Search, title: 'Do anything from one place', body: 'Every command, tool, profile and theme.', key: 'KeyP' },
  { icon: PanelLeft, title: 'Open the sidebar', body: 'Projects, terminals and every tool.', key: 'KeyB' },
  { icon: Columns2, title: 'Split the view', body: 'Then drag a pane’s header to rearrange.', key: 'KeyD' },
  { icon: FolderOpen, title: 'Switch projects', body: 'Each project keeps its own tabs.', key: 'KeyO' },
];

function Welcome() {
  const close = useUi((s) => s.close);
  const { themeId, setTheme } = useTheme();
  const finish = close; // marked as seen when shown, so Esc or a backdrop click count too

  return (
    <Sheet title="" onClose={finish} width="w-[min(520px,94vw)]" footer={<Button variant="primary" className="w-full justify-center" onClick={finish}>Get Started</Button>}>
      <div className="flex flex-col items-center text-center">
        <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-[20px] bg-accent/15 text-accent">
          <SquareTerminal size={34} strokeWidth={1.5} />
        </div>
        <h2 className="text-[22px] font-bold tracking-tight">Welcome to Shellmoor</h2>
        <p className="mt-1 text-muted">Terminals, code, servers and containers in one window.</p>
      </div>
      <div className="mt-6 space-y-3">
        {tips.map((t) => (
          <div key={t.key} className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-text/7 text-accent"><t.icon size={17} /></span>
            <div className="min-w-0 flex-1">
              <div className="font-medium">{t.title}</div>
              <div className="text-[12px] text-muted">{t.body}</div>
            </div>
            <Kbd>{keyLabel(t.key)}</Kbd>
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between rounded-xl bg-text/[0.045] px-3.5 py-2.5">
        <span>Appearance</span>
        <Segmented
          value={themeId === 'github-light' ? 'light' : 'dark'}
          onChange={(v) => setTheme(v === 'light' ? 'github-light' : 'shellmoor')}
          options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]}
        />
      </div>
      <p className="mt-2 text-center text-[11px] text-muted">40 more themes in Settings › Appearance.</p>
    </Sheet>
  );
}

export default function Sheets() {
  const sheet = useUi((s) => s.sheet);
  switch (sheet?.type) {
    case 'projects': return <ProjectSwitcher />;
    case 'newProject': return <NewProject />;
    case 'layouts': return <Layouts />;
    case 'history': return <HistorySheet />;
    case 'host': return <HostEditor key={sheet.hostId ?? 'new'} hostId={sheet.hostId} />;
    case 'welcome': return <Welcome />;
    default: return null;
  }
}
