import { useState, type MouseEvent } from 'react';
import { CloudDownload, Container, Copy, Loader, Play, RotateCw, Square, SquareTerminal, Trash } from 'lucide-react';
import { confirm, contextMenu, prompt, toast } from '../store/overlays';
import { openTerminalWith } from '../components/Terminal';
import { copyText } from '../backend';
import { Badge, Button, EmptyState, IconButton, Segmented, StatusDot, Toolbar, Toggle, row, td, th, wideOnly } from '../ui';

// TODO(backend): dummy engine state until the Go side talks to the Docker API. Actions change local state only.
type Status = 'running' | 'exited' | 'starting' | 'stopping';
type Ctr = { id: string; name: string; image: string; status: Status; ports: string; cpu: string; mem: string };
type Img = { repo: string; tag: string; size: string; created: string };

const initialContainers: Ctr[] = [
  { id: 'a1b2c3', name: 'api', image: 'myapp/api:1.4.2', status: 'running', ports: '8080 → 8080', cpu: '2.1%', mem: '148 MB' },
  { id: 'd4e5f6', name: 'postgres', image: 'postgres:16', status: 'running', ports: '5432 → 5432', cpu: '0.4%', mem: '62 MB' },
  { id: 'g7h8i9', name: 'redis', image: 'redis:7-alpine', status: 'running', ports: '6379 → 6379', cpu: '0.1%', mem: '8 MB' },
  { id: 'j0k1l2', name: 'worker', image: 'myapp/worker:1.4.2', status: 'exited', ports: '', cpu: '', mem: '' },
];

const initialImages: Img[] = [
  { repo: 'myapp/api', tag: '1.4.2', size: '212 MB', created: '2 hours ago' },
  { repo: 'myapp/worker', tag: '1.4.2', size: '198 MB', created: '2 hours ago' },
  { repo: 'postgres', tag: '16', size: '432 MB', created: '3 weeks ago' },
  { repo: 'redis', tag: '7-alpine', size: '41 MB', created: '1 month ago' },
];

const logsFor = (name: string) =>
  name === 'worker'
    ? `2026-11-02T08:01:12Z INFO  worker starting, concurrency=4\n2026-11-02T08:01:13Z ERROR connect ECONNREFUSED redis:6379\n2026-11-02T08:01:13Z FATAL giving up after 3 retries\nexited with code 1`
    : `2026-11-02T09:14:01Z INFO  ${name} listening\n2026-11-02T09:14:02Z INFO  connected to postgres\n2026-11-02T09:15:33Z INFO  GET /health 200 1ms\n2026-11-02T09:16:10Z WARN  slow query (412ms): SELECT * FROM orders\n2026-11-02T09:17:45Z ERROR redis timeout after 2s, retrying`;

const logColor = (l: string) => (/ERROR|FATAL|exited/.test(l) ? 'text-danger' : l.includes('WARN') ? 'text-warning' : 'text-text');
const tone = (s: Status) => (s === 'running' ? 'success' : s === 'exited' ? 'neutral' : 'warning');

export default function Docker() {
  const [view, setView] = useState<'containers' | 'images'>('containers');
  const [containers, setContainers] = useState(initialContainers);
  const [images, setImages] = useState(initialImages);
  const [selected, setSelected] = useState(initialContainers[0].name);
  const [follow, setFollow] = useState(true);
  const running = containers.filter((c) => c.status === 'running').length;

  const setStatus = (id: string, status: Status, patch: Partial<Ctr> = {}) => setContainers((cs) => cs.map((c) => (c.id === id ? { ...c, status, ...patch } : c)));

  // Transitional states for a moment, like Docker Desktop.
  const start = (c: Ctr) => {
    setStatus(c.id, 'starting');
    setTimeout(() => (setStatus(c.id, 'running', { cpu: '0.2%', mem: '24 MB', ports: c.ports || '—' }), toast(`Started ${c.name}`, { tone: 'success' })), 900);
  };
  const stop = (c: Ctr) => {
    setStatus(c.id, 'stopping');
    setTimeout(() => (setStatus(c.id, 'exited', { cpu: '', mem: '' }), toast(`Stopped ${c.name}`)), 900);
  };
  const restart = (c: Ctr) => {
    setStatus(c.id, 'stopping');
    setTimeout(() => start(c), 600);
  };
  const remove = async (c: Ctr) => {
    const ok = await confirm({ title: `Remove ${c.name}?`, message: `${c.status === 'running' ? 'The container is running and will be stopped. ' : ''}Its filesystem is deleted; volumes are kept.`, confirmLabel: 'Remove', destructive: true });
    if (ok) (setContainers((cs) => cs.filter((x) => x.id !== c.id)), toast(`Removed ${c.name}`));
  };
  const shell = (c: Ctr) => openTerminalWith(`docker exec -it ${c.name} sh`);

  const pull = async () => {
    const ref = await prompt({ title: 'Pull Image', placeholder: 'nginx:1.27-alpine', confirmLabel: 'Pull' });
    if (!ref) return;
    const [repo, tag = 'latest'] = ref.split(':');
    toast(`Pulling ${repo}:${tag}…`);
    setTimeout(() => (setImages((is) => [{ repo, tag, size: '48 MB', created: 'just now' }, ...is]), toast(`Pulled ${repo}:${tag}`, { tone: 'success' })), 1500);
  };
  const removeImage = async (im: Img) => {
    const inUse = containers.some((c) => c.image === `${im.repo}:${im.tag}`);
    if (inUse) return toast('Image is in use', { tone: 'warning', description: 'Remove the containers using it first.' });
    if (await confirm({ title: `Remove ${im.repo}:${im.tag}?`, confirmLabel: 'Remove', destructive: true })) setImages((is) => is.filter((x) => x !== im));
  };

  const ctrMenu = (e: MouseEvent, c: Ctr) =>
    contextMenu(e, [
      c.status === 'running' ? { label: 'Stop', icon: Square, onSelect: () => stop(c) } : { label: 'Start', icon: Play, onSelect: () => start(c) },
      { label: 'Restart', icon: RotateCw, disabled: c.status !== 'running', onSelect: () => restart(c) },
      { label: 'Open Shell', icon: SquareTerminal, disabled: c.status !== 'running', onSelect: () => shell(c) },
      { label: 'Copy ID', icon: Copy, onSelect: () => copyText(c.id) },
      'separator',
      { label: 'Remove…', icon: Trash, danger: true, onSelect: () => remove(c) },
    ]);

  return (
    <div className="flex h-full flex-col">
      <Toolbar>
        <Segmented value={view} onChange={setView} options={[{ value: 'containers', label: 'Containers' }, { value: 'images', label: 'Images' }]} />
        <span className="flex-1" />
        <span className={`flex items-center gap-1.5 text-xs text-muted ${wideOnly}`}>
          <StatusDot tone="success" />
          docker-desktop · {running} running
        </span>
        {view === 'images' && <Button variant="ghost" icon={CloudDownload} onClick={pull}>Pull…</Button>}
      </Toolbar>

      {view === 'containers' ? (
        containers.length === 0 ? (
          <EmptyState icon={Container} title="No containers" body="Run docker compose up or docker run to see containers here." />
        ) : (
          <>
            <div className="max-h-[55%] shrink-0 overflow-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className={th}>Name</th><th className={`${th} ${wideOnly}`}>Image</th><th className={`${th} ${wideOnly}`}>Ports</th>
                    <th className={th}>CPU</th><th className={th}>Memory</th><th className={th} />
                  </tr>
                </thead>
                <tbody>
                  {containers.map((c) => {
                    const busy = c.status === 'starting' || c.status === 'stopping';
                    return (
                      <tr key={c.id} onClick={() => setSelected(c.name)} onContextMenu={(e) => ctrMenu(e, c)} className={`${row} group ${selected === c.name ? '!bg-accent/10' : ''}`}>
                        <td className={td}>
                          <span className="flex items-center gap-2">
                            {busy ? <Loader size={11} className="animate-spin text-warning" /> : <StatusDot tone={tone(c.status)} />}
                            <span className="font-medium">{c.name}</span>
                            {c.status === 'exited' && <Badge>exited</Badge>}
                          </span>
                        </td>
                        <td className={`${td} font-mono text-xs text-muted ${wideOnly}`}>{c.image}</td>
                        <td className={`${td} text-muted ${wideOnly}`}>{c.ports || '—'}</td>
                        <td className={`${td} tabular-nums text-muted`}>{c.cpu || '—'}</td>
                        <td className={`${td} tabular-nums text-muted`}>{c.mem || '—'}</td>
                        <td className={`${td} text-right`}>
                          <span className="inline-flex opacity-0 group-hover:opacity-100">
                            {c.status === 'running' ? (
                              <IconButton icon={Square} size={13} label="Stop" onClick={(e) => (e.stopPropagation(), stop(c))} />
                            ) : (
                              <IconButton icon={Play} size={13} label="Start" disabled={busy} onClick={(e) => (e.stopPropagation(), start(c))} />
                            )}
                            <IconButton icon={RotateCw} size={13} label="Restart" disabled={c.status !== 'running'} onClick={(e) => (e.stopPropagation(), restart(c))} />
                            <IconButton icon={SquareTerminal} size={13} label="Open shell" disabled={c.status !== 'running'} onClick={(e) => (e.stopPropagation(), shell(c))} />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex h-9 shrink-0 items-center gap-2 border-y border-border px-3 text-xs">
              <span className="font-medium">Logs</span>
              <span className="text-muted">{selected}</span>
              <span className="flex-1" />
              <span className="text-muted">Follow</span>
              <Toggle on={follow} onChange={setFollow} />
            </div>
            <pre className="min-h-0 flex-1 overflow-auto px-3 py-2 font-mono text-xs leading-5">
              {logsFor(selected).split('\n').map((l, i) => <div key={i} className={logColor(l)}>{l}</div>)}
              {follow && containers.find((c) => c.name === selected)?.status === 'running' && <div className="animate-pulse text-muted">▋</div>}
            </pre>
          </>
        )
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full">
            <thead>
              <tr><th className={th}>Repository</th><th className={th}>Tag</th><th className={th}>Size</th><th className={`${th} ${wideOnly}`}>Created</th><th className={th} /></tr>
            </thead>
            <tbody>
              {images.map((im) => (
                <tr key={im.repo + im.tag} className={`${row} group`}>
                  <td className={`${td} font-medium`}>{im.repo}</td>
                  <td className={td}><Badge tone="accent">{im.tag}</Badge></td>
                  <td className={`${td} tabular-nums text-muted`}>{im.size}</td>
                  <td className={`${td} text-muted ${wideOnly}`}>{im.created}</td>
                  <td className={`${td} w-10 text-right`}>
                    <IconButton icon={Trash} size={13} label="Remove image" className="opacity-0 hover:!text-danger group-hover:opacity-100" onClick={() => removeImage(im)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
