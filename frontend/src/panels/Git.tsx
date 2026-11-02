import { useState } from 'react';

// Dummy data until the Go side runs git.
const changes = [
  { file: 'src/App.tsx', status: 'M', staged: true },
  { file: 'src/store/workspace.ts', status: 'M', staged: false },
  { file: 'src/panels/Git.tsx', status: 'A', staged: false },
  { file: 'old/legacy.ts', status: 'D', staged: false },
];

const diff = `@@ -1,6 +1,8 @@
 import Workspace from './pages/Workspace';
+import { useEffect } from 'react';

 function App() {
-  return <Workspace />;
+  useEffect(() => console.log('mounted'), []);
+  return <Workspace />;
 }`;

const commits = [
  { hash: '456f62e', msg: 'project structure', when: '2h ago' },
  { hash: '831fc0a', msg: 'check complete', when: '1d ago' },
  { hash: '3a9b1d2', msg: 'initial commit', when: '3d ago' },
];

const statusColor: Record<string, string> = { M: 'text-yellow-400', A: 'text-accent', D: 'text-red-400' };

export default function Git() {
  const [selected, setSelected] = useState(changes[0].file);
  const [message, setMessage] = useState('');

  const Row = ({ c }: { c: (typeof changes)[number] }) => (
    <div
      onClick={() => setSelected(c.file)}
      className={`flex cursor-pointer items-center gap-2 px-3 py-0.5 hover:bg-bg ${selected === c.file ? 'bg-bg' : ''}`}
    >
      <span className={`w-3 font-mono ${statusColor[c.status]}`}>{c.status}</span>
      <span className="truncate text-text">{c.file}</span>
    </div>
  );

  return (
    <div className="flex h-full text-sm">
      <div className="flex w-64 shrink-0 flex-col border-r border-border">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-accent">⎇ main</span>
          <span className="text-xs text-muted">↑1 ↓0</span>
        </div>
        <div className="p-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Commit message"
            rows={2}
            className="w-full resize-none rounded border border-border bg-bg px-2 py-1 text-text outline-none focus:border-accent/60"
          />
          <div className="mt-1 flex gap-1">
            <button className="flex-1 rounded bg-accent/90 py-1 text-bg hover:bg-accent">Commit</button>
            <button className="rounded border border-border px-2 text-muted hover:text-accent">Pull</button>
            <button className="rounded border border-border px-2 text-muted hover:text-accent">Push</button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="px-3 pt-2 text-xs uppercase tracking-wide text-muted">Staged</div>
          {changes.filter((c) => c.staged).map((c) => <Row key={c.file} c={c} />)}
          <div className="px-3 pt-2 text-xs uppercase tracking-wide text-muted">Changes</div>
          {changes.filter((c) => !c.staged).map((c) => <Row key={c.file} c={c} />)}
          <div className="px-3 pt-3 text-xs uppercase tracking-wide text-muted">History</div>
          {commits.map((c) => (
            <div key={c.hash} className="flex gap-2 px-3 py-0.5">
              <span className="font-mono text-muted">{c.hash}</span>
              <span className="flex-1 truncate text-text">{c.msg}</span>
              <span className="text-xs text-muted">{c.when}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="min-w-0 flex-1 overflow-auto">
        <div className="border-b border-border px-3 py-1 text-xs text-muted">{selected}</div>
        <pre className="p-3 font-mono text-xs">
          {diff.split('\n').map((line, i) => (
            <div
              key={i}
              className={
                line.startsWith('+') ? 'bg-accent/10 text-accent' : line.startsWith('-') ? 'bg-red-400/10 text-red-400' : line.startsWith('@@') ? 'text-muted' : 'text-text'
              }
            >
              {line || ' '}
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
