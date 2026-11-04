import { useState } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronDown, Copy, FileCode, GitBranch, GitCommitHorizontal, Loader, Minus, Plus, RefreshCw, Search, Undo2 } from 'lucide-react';
import { useWorkspace } from '../store/workspace';
import { confirm, contextMenu, prompt, toast } from '../store/overlays';
import { copyText } from '../backend';
import { Badge, Button, EmptyState, IconButton, SectionLabel, Segmented, Toolbar, cx, type Tone } from '../ui';

// TODO(backend): dummy repository until the Go side runs git. Everything here is local state.
type Change = { file: string; status: 'M' | 'A' | 'D'; staged: boolean; diff: string };
type Commit = { hash: string; msg: string; author: string; when: string };

const initialChanges: Change[] = [
  {
    file: 'src/App.tsx', status: 'M', staged: true,
    diff: `@@ -1,6 +1,8 @@
 import Workspace from './pages/Workspace';
+import { useEffect } from 'react';

 function App() {
-  return <Workspace />;
+  useEffect(() => console.log('mounted'), []);
+  return <Workspace />;
 }`,
  },
  {
    file: 'src/store/workspace.ts', status: 'M', staged: false,
    diff: `@@ -40,9 +40,12 @@ export const useWorkspace = create<WorkspaceState>()(
   persist(
     (set, get) => ({
-      tabs: [first],
-      activeTabId: first.id,
+      ...emptySnapshot(),
+      load: (snapshot) => set(cloneSnapshot(snapshot)),
     }),
-    { name: 'workspace' },
+    {
+      name: 'shellmoor-workspace',
+      merge: (persisted, current) => ({ ...current, ...cloneSnapshot(persisted) }),
+    },
   ),
 );`,
  },
  {
    file: 'src/panels/Tasks.tsx', status: 'A', staged: false,
    diff: `@@ -0,0 +1,6 @@
+import { useState } from 'react';
+
+export default function Tasks() {
+  const [runs, setRuns] = useState({});
+  return <div className="flex h-full" />;
+}`,
  },
  {
    file: 'old/legacy.ts', status: 'D', staged: false,
    diff: `@@ -1,4 +0,0 @@
-// Deprecated: use store/workspace.ts
-export function legacyLayout() {
-  return null;
-}`,
  },
];

const initialCommits: Commit[] = [
  { hash: '456f62e', msg: 'project structure', author: 'Adib', when: '2h' },
  { hash: '831fc0a', msg: 'check complete', author: 'Adib', when: '1d' },
  { hash: '3a9b1d2', msg: 'initial commit', author: 'Adib', when: '3d' },
];

const localBranches = ['main', 'feature/workspace-persistence', 'fix/terminal-resize', 'release/0.1'];
const remoteBranches = ['origin/main', 'origin/feature/workspace-persistence', 'origin/release/0.1', 'origin/dependabot/npm/vite-8.3.5'];

const statusTone: Record<Change['status'], Tone> = { M: 'warning', A: 'success', D: 'danger' };
const lineClass = (l: string) => (l.startsWith('+') ? 'bg-success/10 text-success' : l.startsWith('-') ? 'bg-danger/10 text-danger' : l.startsWith('@@') ? 'text-muted' : 'text-text');

// Pairs removed/added runs side by side; context lines appear on both sides.
function splitRows(diff: string) {
  const rows: [string | null, string | null][] = [];
  let minus: string[] = [];
  let plus: string[] = [];
  const flush = () => {
    for (let i = 0; i < Math.max(minus.length, plus.length); i++) rows.push([minus[i] ?? null, plus[i] ?? null]);
    minus = [];
    plus = [];
  };
  for (const l of diff.split('\n')) {
    if (l.startsWith('-')) minus.push(l);
    else if (l.startsWith('+')) plus.push(l);
    else (flush(), rows.push([l, l]));
  }
  flush();
  return rows;
}

function BranchPicker({ branch, branches, onSwitch, onCreate }: { branch: string; branches: string[]; onSwitch: (b: string) => void; onCreate: () => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const match = (b: string) => b.toLowerCase().includes(query.toLowerCase());
  const item = (b: string, current: boolean) => (
    <button key={b} onClick={() => (onSwitch(b.replace(/^origin\//, '')), setOpen(false))} className="flex h-7 w-full items-center gap-2 rounded-md px-2.5 text-left hover:bg-accent hover:text-bg">
      <GitBranch size={13} />
      <span className="flex-1 truncate">{b}</span>
      {current && <Check size={13} />}
    </button>
  );
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex h-7 items-center gap-1.5 rounded-lg px-2 font-medium hover:bg-text/8">
        <GitBranch size={14} className="text-accent" />
        {branch}
        <ChevronDown size={12} className="text-muted" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onMouseDown={() => setOpen(false)} />
          <div className="glass absolute left-0 top-full z-40 mt-1.5 w-72 animate-pop rounded-xl p-1.5">
            <div className="mb-1 flex items-center gap-2 rounded-md bg-text/6 px-2">
              <Search size={12} className="text-muted" />
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Switch to branch…" className="h-7 flex-1 bg-transparent outline-none" />
            </div>
            <div className="max-h-72 overflow-y-auto">
              <div className="px-2.5 pb-0.5 pt-1.5 text-[11px] font-semibold text-muted">Local</div>
              {branches.filter(match).map((b) => item(b, b === branch))}
              <div className="px-2.5 pb-0.5 pt-2 text-[11px] font-semibold text-muted">Remote</div>
              {remoteBranches.filter(match).map((b) => item(b, false))}
            </div>
            <div className="mx-2 my-1 border-t border-border" />
            <button onClick={() => (setOpen(false), onCreate())} className="flex h-7 w-full items-center gap-2 rounded-md px-2.5 text-left hover:bg-accent hover:text-bg">
              <Plus size={13} /> New Branch…
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function Git() {
  const [changes, setChanges] = useState(initialChanges);
  const [commits, setCommits] = useState(initialCommits);
  const [branch, setBranch] = useState('main');
  const [branches, setBranches] = useState(localBranches);
  const [ahead, setAhead] = useState(1);
  const [behind, setBehind] = useState(2);
  const [selected, setSelected] = useState(initialChanges[0].file);
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<'unified' | 'split'>('unified');
  const [busy, setBusy] = useState<'pull' | 'push' | null>(null);

  const staged = changes.filter((c) => c.staged);
  const unstaged = changes.filter((c) => !c.staged);
  const current = changes.find((c) => c.file === selected);

  const setStaged = (files: string[], on: boolean) => setChanges((cs) => cs.map((c) => (files.includes(c.file) ? { ...c, staged: on } : c)));

  const commit = () => {
    const hash = Math.random().toString(16).slice(2, 9);
    setCommits((cs) => [{ hash, msg: message.trim(), author: 'You', when: 'now' }, ...cs]);
    setChanges((cs) => cs.filter((c) => !c.staged));
    setAhead((a) => a + 1);
    toast(`Committed ${staged.length} file${staged.length > 1 ? 's' : ''}`, { tone: 'success', description: `${hash} ${message.trim()}` });
    setMessage('');
  };

  const pull = () => {
    setBusy('pull');
    setTimeout(() => {
      setBusy(null);
      toast(behind ? `Pulled ${behind} commit${behind > 1 ? 's' : ''}` : 'Already up to date', { tone: 'success', description: `origin/${branch}` });
      setBehind(0);
    }, 1200);
  };

  const push = () => {
    if (behind) return toast('Pull first', { tone: 'warning', description: `origin/${branch} has ${behind} commit${behind > 1 ? 's' : ''} you don’t have.`, action: { label: 'Pull', run: pull } });
    setBusy('push');
    setTimeout(() => {
      setBusy(null);
      toast(ahead ? `Pushed ${ahead} commit${ahead > 1 ? 's' : ''}` : 'Nothing to push', { tone: 'success', description: `origin/${branch}` });
      setAhead(0);
    }, 1400);
  };

  const switchBranch = async (b: string) => {
    if (b === branch) return;
    if (changes.length && !(await confirm({ title: `Switch to ${b}?`, message: `Your ${changes.length} uncommitted change${changes.length > 1 ? 's' : ''} will come with you.`, confirmLabel: 'Switch' }))) return;
    setBranch(b);
    toast(`Switched to ${b}`);
  };

  const createBranch = async () => {
    const name = await prompt({ title: 'New Branch', message: `Starts from ${branch}.`, placeholder: 'feature/my-change', confirmLabel: 'Create Branch' });
    if (!name) return;
    setBranches((bs) => (bs.includes(name) ? bs : [...bs, name]));
    setBranch(name);
    setAhead(0);
    setBehind(0);
    toast(`Created and switched to ${name}`, { tone: 'success' });
  };

  const discard = async (c: Change) => {
    if (!(await confirm({ title: `Discard changes to ${c.file.split('/').pop()}?`, message: 'This can’t be undone.', confirmLabel: 'Discard', destructive: true }))) return;
    setChanges((cs) => cs.filter((x) => x.file !== c.file));
  };

  // A render function, not a nested component: a nested component gets a new identity every render,
  // so React would rebuild the rows between mousedown and mouseup and swallow the click.
  const renderRow = (c: Change) => (
    <div
      key={c.file}
      onClick={() => setSelected(c.file)}
      onDoubleClick={() => setStaged([c.file], !c.staged)}
      onContextMenu={(e) =>
        contextMenu(e, [
          { label: c.staged ? 'Unstage' : 'Stage', icon: c.staged ? Minus : Plus, onSelect: () => setStaged([c.file], !c.staged) },
          { label: 'Open in Editor', icon: FileCode, disabled: c.status === 'D', onSelect: () => useWorkspace.getState().openTool('editor') },
          { label: 'Copy Path', icon: Copy, onSelect: () => copyText(c.file) },
          'separator',
          { label: 'Discard Changes…', icon: Undo2, danger: true, onSelect: () => discard(c) },
        ])
      }
      className={cx('group mx-1.5 flex h-7 items-center gap-2 rounded-md pl-2 pr-1', selected === c.file ? 'bg-accent/15' : 'hover:bg-text/5')}
    >
      <span className="min-w-0 flex-1 truncate">
        {c.file.split('/').pop()} <span className="text-[11px] text-muted">{c.file.split('/').slice(0, -1).join('/')}</span>
      </span>
      <IconButton
        icon={c.staged ? Minus : Plus}
        size={13}
        label={c.staged ? 'Unstage' : 'Stage'}
        className="!h-5 !w-5 opacity-0 group-hover:opacity-100"
        onClick={(e) => (e.stopPropagation(), setStaged([c.file], !c.staged))}
      />
      <Badge tone={statusTone[c.status]}>{c.status}</Badge>
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      <Toolbar className="!overflow-visible">
        <BranchPicker branch={branch} branches={branches} onSwitch={switchBranch} onCreate={createBranch} />
        <span className="flex items-center gap-1 text-[11px] tabular-nums text-muted" title={`${ahead} to push, ${behind} to pull`}>
          <ArrowUp size={11} />{ahead} <ArrowDown size={11} />{behind}
        </span>
        <span className="flex-1" />
        <Button variant="ghost" icon={busy === 'pull' ? Loader : ArrowDown} disabled={!!busy} onClick={pull}>Pull</Button>
        <Button variant="ghost" icon={busy === 'push' ? Loader : ArrowUp} disabled={!!busy} onClick={push}>Push</Button>
        <IconButton icon={RefreshCw} label="Refresh" onClick={() => toast('Refreshed', { description: `${changes.length} changed files` })} />
      </Toolbar>

      <div className="flex min-h-0 flex-1">
        <div className="flex w-72 shrink-0 flex-col border-r border-border @max-2xl:w-52">
          <div className="space-y-2 border-b border-border p-3">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.ctrlKey || e.metaKey) && message.trim() && staged.length && commit()}
              placeholder={`Message (${navigator.userAgent.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to commit)`}
              rows={2}
              className="w-full resize-none rounded-md border border-border bg-bg px-2 py-1.5 text-text outline-none placeholder:text-muted/70 focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
            />
            <Button variant="primary" icon={Check} disabled={!message.trim() || !staged.length} className="w-full justify-center" onClick={commit}>
              Commit {staged.length ? `${staged.length} file${staged.length > 1 ? 's' : ''}` : ''}
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pb-2">
            <SectionLabel action={staged.length > 0 && <button className="text-[11px] font-normal hover:text-text" onClick={() => setStaged(staged.map((c) => c.file), false)}>Unstage All</button>}>
              Staged · {staged.length}
            </SectionLabel>
            {staged.map(renderRow)}
            <SectionLabel action={unstaged.length > 0 && <button className="text-[11px] font-normal hover:text-text" onClick={() => setStaged(unstaged.map((c) => c.file), true)}>Stage All</button>}>
              Changes · {unstaged.length}
            </SectionLabel>
            {unstaged.map(renderRow)}
            <SectionLabel>History</SectionLabel>
            {commits.map((c) => (
              <div key={c.hash} className="mx-1.5 flex h-7 items-center gap-2 rounded-md px-2 hover:bg-text/5" title={`${c.author}, ${c.when} ago`}>
                <GitCommitHorizontal size={13} className="shrink-0 text-muted" />
                <span className="font-mono text-[11px] text-muted">{c.hash}</span>
                <span className="min-w-0 flex-1 truncate">{c.msg}</span>
                <span className="text-[11px] text-muted">{c.when}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          {current ? (
            <>
              <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
                <span className="flex-1 truncate font-mono text-xs text-muted">{current.file}</span>
                <Segmented value={mode} onChange={setMode} options={[{ value: 'unified', label: 'Unified' }, { value: 'split', label: 'Split' }]} />
              </div>
              {mode === 'unified' ? (
                <pre className="min-h-0 flex-1 overflow-auto py-2 font-mono text-xs leading-5">
                  {current.diff.split('\n').map((line, i) => (
                    <div key={i} className={`px-3 ${lineClass(line)}`}>{line || ' '}</div>
                  ))}
                </pre>
              ) : (
                <div className="min-h-0 flex-1 overflow-auto py-2 font-mono text-xs leading-5">
                  {splitRows(current.diff).map(([left, right], i) => (
                    <div key={i} className="grid grid-cols-2">
                      {[left, right].map((l, j) => (
                        <div key={j} className={cx('whitespace-pre px-3', j === 0 && 'border-r border-border', l === null ? 'bg-text/[0.03]' : lineClass(l))}>
                          {l ?? ' '}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <EmptyState icon={Check} title="Nothing to commit" body="Your working tree is clean." />
          )}
        </div>
      </div>
    </div>
  );
}
