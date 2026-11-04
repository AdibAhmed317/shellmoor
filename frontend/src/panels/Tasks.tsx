import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CircleCheck, CircleX, Copy, ListChecks, Loader, Play, Plus, RotateCw, Square, Trash } from 'lucide-react';
import { useSettings } from '../store/settings';
import { useProjects } from '../store/projects';
import { confirm, contextMenu, prompt, toast } from '../store/overlays';
import { copyText, notify } from '../backend';
import { formatDuration } from '../store/history';
import { Badge, Button, EmptyState, IconButton, SectionLabel, Toolbar, cx, wideOnly } from '../ui';

// Task definitions are saved; runs live only in memory.
// TODO(backend): detect tasks from package.json / Makefile / Taskfile, and run them in a real PTY.
type Task = { id: string; name: string; command: string; source: 'package.json' | 'Makefile' | 'Taskfile' | 'custom' };
type Run = { status: 'running' | 'success' | 'failed'; startedAt: number; endedAt?: number; output: string[] };

const seed: Task[] = [
  { id: 'dev', name: 'dev', command: 'npm run dev', source: 'package.json' },
  { id: 'build', name: 'build', command: 'npm run build', source: 'package.json' },
  { id: 'lint', name: 'lint', command: 'npm run lint', source: 'package.json' },
  { id: 'test', name: 'test', command: 'go test ./...', source: 'Makefile' },
  { id: 'up', name: 'compose up', command: 'docker compose up -d', source: 'Taskfile' },
];

const useTasks = create<{ tasks: Task[] }>()(persist(() => ({ tasks: seed }), { name: 'shellmoor-tasks' }));

// Simulated output scripts: [delay ms, line]; a null line ends the run (exit 0), 'FAIL' ends it with exit 1.
const scripts: Record<string, [number, string | null][]> = {
  'npm run dev': [[300, '> my-project@1.0.0 dev'], [300, '> vite'], [900, ''], [200, '  VITE v8.3.5  ready in 412 ms'], [100, ''], [100, '  ➜  Local:   http://localhost:5173/'], [100, '  ➜  Network: use --host to expose']],
  'npm run build': [[300, '> tsc && vite build'], [1500, 'vite v8.3.5 building for production...'], [1200, '✓ 412 modules transformed.'], [1400, 'dist/index.html          0.47 kB'], [200, 'dist/assets/index.js   629.92 kB'], [400, '✓ built in 4.21s'], [100, null]],
  'npm run lint': [[400, '> eslint src'], [1600, '✔ No problems found.'], [100, null]],
  'go test ./...': [[500, 'ok   github.com/acme/api/internal/auth    0.412s'], [900, 'ok   github.com/acme/api/internal/orders  1.104s'], [1200, '--- FAIL: TestRefund (0.02s)'], [100, '    refund_test.go:42: expected 200, got 500'], [200, 'FAIL github.com/acme/api/internal/payments 0.231s'], [100, 'FAIL']],
  'docker compose up -d': [[400, '[+] Running 3/3'], [900, ' ✔ Container postgres  Started'], [500, ' ✔ Container redis     Started'], [600, ' ✔ Container api       Started'], [100, null]],
};
const fallback: [number, string | null][] = [[600, 'Running…'], [1800, 'Done.'], [100, null]];

export default function Tasks() {
  const tasks = useTasks((s) => s.tasks);
  const project = useProjects((s) => s.projects.find((p) => p.id === s.currentId));
  const [selected, setSelected] = useState(tasks[0]?.id);
  const [runs, setRuns] = useState<Record<string, Run>>({});
  const [, tick] = useState(0);
  const timers = useRef(new Map<string, number[]>());
  const outputRef = useRef<HTMLPreElement>(null);
  const task = tasks.find((t) => t.id === selected) ?? tasks[0];
  const run = task && runs[task.id];

  // Elapsed-time display for running tasks.
  useEffect(() => {
    if (!Object.values(runs).some((r) => r.status === 'running')) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [runs]);

  useEffect(() => () => timers.current.forEach((ts) => ts.forEach(clearTimeout)), []);
  // Braces matter: scrollTo returns a Promise in current Chromium, and an effect must not return one.
  useEffect(() => {
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight });
  }, [run?.output.length]);

  // Side effects stay outside state updaters (React may run updaters twice).
  const runsRef = useRef(runs);
  runsRef.current = runs;
  const finish = (t: Task, status: Run['status']) => {
    const startedAt = runsRef.current[t.id]?.startedAt ?? Date.now();
    const endedAt = Date.now();
    const seconds = (endedAt - startedAt) / 1000;
    const { notifyOnFinish, notifyAfterSeconds, notifyOnlyInBackground } = useSettings.getState();
    const message = status === 'success' ? `${t.name} finished` : `${t.name} failed`;
    toast(message, { tone: status === 'success' ? 'success' : 'danger', description: `${t.command} · ${formatDuration(seconds * 1000)}` });
    if (notifyOnFinish && seconds >= notifyAfterSeconds && (!notifyOnlyInBackground || document.hidden)) notify(message, t.command);
    setRuns((r) => ({ ...r, [t.id]: { ...r[t.id], status, endedAt } }));
  };

  const start = (t: Task) => {
    stop(t, true);
    setRuns((r) => ({ ...r, [t.id]: { status: 'running', startedAt: Date.now(), output: [`$ ${t.command}`] } }));
    let at = 0;
    const ids = (scripts[t.command] ?? fallback).map(([delay, line]) => {
      at += delay;
      return window.setTimeout(() => {
        if (line === null) return finish(t, 'success');
        if (line === 'FAIL') return finish(t, 'failed');
        setRuns((r) => ({ ...r, [t.id]: { ...r[t.id], output: [...r[t.id].output, line] } }));
      }, at);
    });
    timers.current.set(t.id, ids);
  };

  function stop(t: Task, silent = false) {
    timers.current.get(t.id)?.forEach(clearTimeout);
    timers.current.delete(t.id);
    if (!silent) setRuns((r) => (r[t.id]?.status === 'running' ? { ...r, [t.id]: { ...r[t.id], status: 'failed', endedAt: Date.now(), output: [...r[t.id].output, '^C', 'Stopped.'] } } : r));
  }

  const addTask = async () => {
    const command = await prompt({ title: 'New Task', message: 'A command you run often, like a build or test.', placeholder: 'npm run test', confirmLabel: 'Next' });
    if (!command) return;
    const name = await prompt({ title: 'Name This Task', value: command.split(' ').pop() ?? command, confirmLabel: 'Add Task' });
    if (!name) return;
    const id = crypto.randomUUID();
    useTasks.setState((s) => ({ tasks: [...s.tasks, { id, name, command, source: 'custom' }] }));
    setSelected(id);
  };

  const removeTask = async (t: Task) => {
    if (!(await confirm({ title: `Remove “${t.name}”?`, confirmLabel: 'Remove', destructive: true }))) return;
    stop(t, true);
    useTasks.setState((s) => ({ tasks: s.tasks.filter((x) => x.id !== t.id) }));
  };

  if (!task) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <EmptyState icon={ListChecks} title="No tasks" body="Save commands you run often (builds, tests, dev servers) and run them with one click." />
        <Button variant="primary" icon={Plus} onClick={addTask}>Add Task</Button>
      </div>
    );
  }

  const elapsed = (r?: Run) => (r ? formatDuration((r.endedAt ?? Date.now()) - r.startedAt) : '');
  const statusIcon = (r?: Run) =>
    !r ? <span className="w-3.5" /> : r.status === 'running' ? <Loader size={14} className="animate-spin text-accent" /> : r.status === 'success' ? <CircleCheck size={14} className="text-success" /> : <CircleX size={14} className="text-danger" />;

  return (
    <div className="flex h-full">
      <div className="flex w-60 shrink-0 flex-col border-r border-border @max-xl:w-44">
        <SectionLabel action={<IconButton icon={Plus} size={13} label="Add task" className="!h-5 !w-5" onClick={addTask} />}>
          {project?.name ?? 'Tasks'}
        </SectionLabel>
        <div className="min-h-0 flex-1 overflow-y-auto pb-2">
          {tasks.map((t) => {
            const r = runs[t.id];
            return (
              <div
                key={t.id}
                onClick={() => setSelected(t.id)}
                onDoubleClick={() => start(t)}
                onContextMenu={(e) =>
                  contextMenu(e, [
                    { label: r?.status === 'running' ? 'Restart' : 'Run', icon: Play, onSelect: () => start(t) },
                    { label: 'Stop', icon: Square, disabled: r?.status !== 'running', onSelect: () => stop(t) },
                    { label: 'Copy Command', icon: Copy, onSelect: () => copyText(t.command) },
                    'separator',
                    { label: 'Remove…', icon: Trash, danger: true, onSelect: () => removeTask(t) },
                  ])
                }
                className={cx('group mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5', t.id === task.id ? 'bg-text/12' : 'hover:bg-text/6')}
              >
                {statusIcon(r)}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{t.name}</div>
                  <div className="truncate font-mono text-[11px] text-muted">{t.command}</div>
                </div>
                {r && <span className="text-[11px] tabular-nums text-muted">{elapsed(r)}</span>}
                <IconButton
                  icon={r?.status === 'running' ? Square : Play}
                  size={12}
                  label={r?.status === 'running' ? 'Stop' : 'Run'}
                  className="!h-6 !w-6 opacity-0 group-hover:opacity-100"
                  onClick={(e) => (e.stopPropagation(), r?.status === 'running' ? stop(t) : start(t))}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <Toolbar>
          {statusIcon(run)}
          <span className="font-medium">{task.name}</span>
          <span className={`truncate font-mono text-xs text-muted ${wideOnly}`}>{task.command}</span>
          <span className={wideOnly}><Badge>{task.source}</Badge></span>
          <span className="flex-1" />
          {run && <span className="text-[11px] tabular-nums text-muted">{run.status === 'running' ? 'Running · ' : ''}{elapsed(run)}</span>}
          {run?.status === 'running' ? (
            <>
              <IconButton icon={RotateCw} label="Restart" onClick={() => start(task)} />
              <Button icon={Square} onClick={() => stop(task)}>Stop</Button>
            </>
          ) : (
            <Button variant="primary" icon={Play} onClick={() => start(task)}>Run</Button>
          )}
        </Toolbar>
        {run ? (
          <pre ref={outputRef} className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap p-4 font-mono text-xs leading-5">
            {run.output.map((line, i) => (
              <div key={i} className={line.startsWith('$') ? 'text-muted' : /FAIL|error/i.test(line) ? 'text-danger' : /✓|✔|ok /.test(line) ? 'text-success' : 'text-text'}>
                {line || ' '}
              </div>
            ))}
            {run.status !== 'running' && (
              <div className={cx('mt-2', run.status === 'success' ? 'text-success' : 'text-danger')}>
                {run.status === 'success' ? '✓ Finished' : '✕ Exited with an error'} in {elapsed(run)}
              </div>
            )}
          </pre>
        ) : (
          <EmptyState icon={Play} title={`Run ${task.name}`} body="Output appears here. Double-click a task to run it." />
        )}
      </div>
    </div>
  );
}
