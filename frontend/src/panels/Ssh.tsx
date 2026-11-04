import { useEffect, useState, type MouseEvent } from 'react';
import { Activity, ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Download, File, Folder, Loader, Pencil, Plug, Plus, Server, SquareTerminal, Trash, Upload, X } from 'lucide-react';
import { address, useHosts, type Host } from '../store/hosts';
import { useUi } from '../store/ui';
import { useWorkspace } from '../store/workspace';
import { confirm, contextMenu, toast } from '../store/overlays';
import { pickFile } from '../backend';
import { showHostActivity } from './Monitor';
import { Badge, Button, EmptyState, IconButton, ListRow, SectionLabel, Segmented, StatusDot, Toolbar, row, td, th, wideOnly, type Tone } from '../ui';

// TODO(backend): real SSH sessions and SFTP. Everything below the hosts store is simulated.
const remoteFiles = [
  { name: 'app', dir: true, size: '', modified: 'Oct 30' },
  { name: 'logs', dir: true, size: '', modified: 'Nov 2' },
  { name: 'docker-compose.yml', dir: false, size: '1.2 KB', modified: 'Oct 28' },
  { name: '.env', dir: false, size: '312 B', modified: 'Oct 12' },
  { name: 'backup-2026-11-01.sql.gz', dir: false, size: '2.4 GB', modified: 'Nov 1' },
];

type Conn = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed';
const connTone: Record<Conn, Tone> = { idle: 'neutral', connecting: 'warning', connected: 'success', reconnecting: 'warning', failed: 'danger' };
const connLabel: Record<Conn, string> = { idle: 'Not connected', connecting: 'Connecting…', connected: 'Connected', reconnecting: 'Reconnecting…', failed: 'Connection failed' };

type Transfer = { id: number; name: string; dir: 'up' | 'down'; progress: number };
let nextTransfer = 1;

export default function Ssh() {
  const hosts = useHosts((s) => s.hosts);
  const open = useUi((s) => s.open);
  const [selectedId, setSelectedId] = useState(hosts[0]?.id);
  const [view, setView] = useState<'shell' | 'files'>('shell');
  const [conn, setConn] = useState<Record<string, Conn>>({});
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const host = hosts.find((h) => h.id === selectedId) ?? hosts[0];
  const groups = [...new Set(hosts.map((h) => h.group))];

  // Simulated transfer progress.
  useEffect(() => {
    if (!transfers.some((t) => t.progress < 100)) return;
    const id = setInterval(() => setTransfers((ts) => ts.map((t) => (t.progress < 100 ? { ...t, progress: Math.min(100, t.progress + 7 + Math.random() * 12) } : t))), 300);
    return () => clearInterval(id);
  }, [transfers]);

  if (!host) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <EmptyState icon={Server} title="No remote hosts" body="Add a server to open SSH sessions, browse files over SFTP and watch its activity." />
        <Button variant="primary" icon={Plus} onClick={() => open({ type: 'host', hostId: null })}>Add Host</Button>
      </div>
    );
  }

  const state = conn[host.id] ?? 'idle';
  const jump = hosts.find((h) => h.id === host.jumpHost);
  const isProd = host.group === 'Production';

  const connect = (h: Host) => {
    setConn((c) => ({ ...c, [h.id]: 'connecting' }));
    setTimeout(() => {
      setConn((c) => ({ ...c, [h.id]: h.online ? 'connected' : 'failed' }));
      if (!h.online) toast(`Couldn’t reach ${h.name}`, { tone: 'danger', description: `${address(h)}:${h.port} timed out after 10 s`, action: { label: 'Try Again', run: () => connect(h) } });
    }, 900);
  };
  const disconnect = (h: Host) => setConn((c) => ({ ...c, [h.id]: 'idle' }));

  const startTransfer = async (dir: 'up' | 'down', name?: string) => {
    const file = name ?? (await pickFile('Choose File to Upload'))?.split(/[\\/]/).pop() ?? 'release.tar.gz'; // preview fallback name
    setTransfers((ts) => [...ts, { id: nextTransfer++, name: file, dir, progress: 0 }]);
  };

  const hostMenu = (e: MouseEvent, h: Host) =>
    contextMenu(e, [
      { label: conn[h.id] === 'connected' ? 'Disconnect' : 'Connect', icon: Plug, onSelect: () => (setSelectedId(h.id), conn[h.id] === 'connected' ? disconnect(h) : connect(h)) },
      { label: 'Open in New Terminal', icon: SquareTerminal, onSelect: () => (useWorkspace.getState().addTab('terminal'), toast(`ssh ${address(h)}`, { description: 'Remote terminal sessions need the backend.' })) },
      { label: 'Show Activity', icon: Activity, disabled: !h.online, onSelect: () => showHostActivity(h.id) },
      'separator',
      { label: 'Edit…', icon: Pencil, onSelect: () => open({ type: 'host', hostId: h.id }) },
      {
        label: 'Delete…', icon: Trash, danger: true,
        onSelect: async () => {
          if (await confirm({ title: `Delete ${h.name}?`, message: 'The saved connection is removed. Nothing changes on the server.', confirmLabel: 'Delete', destructive: true })) useHosts.getState().remove(h.id);
        },
      },
    ]);

  return (
    <div className="flex h-full">
      <div className="flex w-56 shrink-0 flex-col border-r border-border @max-2xl:w-44 @max-md:w-36">
        <div className="min-h-0 flex-1 overflow-y-auto pb-2">
          {groups.map((g) => (
            <div key={g}>
              <SectionLabel>{g}</SectionLabel>
              {hosts.filter((h) => h.group === g).map((h) => (
                <div key={h.id} onContextMenu={(e) => hostMenu(e, h)} onDoubleClick={() => connect(h)}>
                  <ListRow
                    icon={Server}
                    title={h.name}
                    subtitle={address(h)}
                    selected={h.id === host.id}
                    onClick={() => setSelectedId(h.id)}
                    trailing={<StatusDot tone={conn[h.id] === 'connected' ? 'success' : h.online ? 'neutral' : 'danger'} />}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="border-t border-border p-1.5">
          <Button variant="ghost" icon={Plus} className="w-full" onClick={() => open({ type: 'host', hostId: null })}>Add Host</Button>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <Toolbar>
          {/* Narrow panes keep only Connect; the rest returns as the pane widens. */}
          <span className="@max-lg:hidden">
            <Badge tone={isProd ? 'danger' : 'neutral'}>{isProd ? 'PRODUCTION' : 'REMOTE'}</Badge>
          </span>
          <span className={`flex min-w-0 items-center gap-1.5 text-xs ${wideOnly}`}>
            <StatusDot tone={connTone[state]} />
            <span className="truncate font-mono">{address(host)}:{host.port}</span>
            {jump && <span className="truncate text-muted">via {jump.name}</span>}
          </span>
          <span className="flex-1" />
          <span className="@max-lg:hidden">
            <Segmented value={view} onChange={setView} options={[{ value: 'shell', label: 'Shell' }, { value: 'files', label: 'Files' }]} />
          </span>
          <IconButton icon={Activity} label="Show activity" disabled={!host.online} className={wideOnly} onClick={() => showHostActivity(host.id)} />
          <IconButton icon={Pencil} label="Edit host" className={wideOnly} onClick={() => open({ type: 'host', hostId: host.id })} />
          {state === 'connected' ? (
            <Button icon={Plug} onClick={() => disconnect(host)}>Disconnect</Button>
          ) : (
            <Button variant="primary" icon={state === 'connecting' ? Loader : Plug} disabled={state === 'connecting'} onClick={() => connect(host)}>
              {state === 'connecting' ? 'Connecting' : 'Connect'}
            </Button>
          )}
        </Toolbar>

        {state === 'reconnecting' && (
          <div className="flex items-center gap-2 border-b border-border bg-warning/10 px-3 py-1.5 text-xs text-warning">
            <Loader size={12} className="animate-spin" /> Connection lost. Reconnecting…
          </div>
        )}

        {host.forwards.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-3 py-1.5 text-[11px] text-muted">
            <ArrowLeftRight size={12} />
            {host.forwards.map((f, i) => (
              <span key={i} className={`rounded-full px-2 py-px font-mono ${state === 'connected' ? 'bg-success/12 text-success' : 'bg-text/8'}`}>
                {f.type === 'dynamic' ? `SOCKS :${f.bindPort}` : `${f.type === 'local' ? 'L' : 'R'} :${f.bindPort} → ${f.target}`}
              </span>
            ))}
          </div>
        )}

        {view === 'shell' ? (
          <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap p-4 font-mono text-xs leading-5 text-text">
            {state === 'connected' ? (
              <>
                {`Welcome to ${host.os} (GNU/Linux x86_64)\n\nLast login: Sun Nov  1 21:04:11 2026 from 192.168.1.42\n`}
                <span className="text-success">{address(host)}</span>
                {':~$ '}
                <span className="animate-pulse">▋</span>
              </>
            ) : (
              <span className="text-muted">{connLabel[state]}. {state === 'failed' ? `${host.name} didn’t respond.` : `Press Connect to open a session on ${host.name}.`}</span>
            )}
          </pre>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border px-3">
              <span className="flex-1 truncate font-mono text-xs text-muted">/home/{host.user}</span>
              <Button variant="ghost" icon={Upload} disabled={state !== 'connected'} onClick={() => startTransfer('up')}>Upload</Button>
            </div>
            {state !== 'connected' ? (
              <EmptyState icon={Folder} title="Connect to browse files" body={`Files on ${host.name} appear here over SFTP.`} />
            ) : (
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full">
                  <thead>
                    <tr><th className={th}>Name</th><th className={`${th} ${wideOnly}`}>Size</th><th className={`${th} ${wideOnly}`}>Modified</th><th className={th} /></tr>
                  </thead>
                  <tbody>
                    {remoteFiles.map((f) => (
                      <tr key={f.name} className={`${row} group`}>
                        <td className={td}>
                          <span className="flex items-center gap-2">
                            {f.dir ? <Folder size={14} className="text-accent" /> : <File size={14} className="text-muted" />}
                            {f.name}
                          </span>
                        </td>
                        <td className={`${td} text-muted ${wideOnly}`}>{f.size || '—'}</td>
                        <td className={`${td} text-muted ${wideOnly}`}>{f.modified}</td>
                        <td className={`${td} w-10 text-right`}>
                          {!f.dir && <IconButton icon={Download} size={13} label="Download" className="opacity-0 group-hover:opacity-100" onClick={() => startTransfer('down', f.name)} />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Transfer queue, like Finder's copy progress. */}
        {transfers.length > 0 && (
          <div className="shrink-0 border-t border-border">
            <div className="flex h-8 items-center px-3 text-xs">
              <span className="flex-1 font-medium">Transfers</span>
              <Button variant="ghost" className="!h-6" onClick={() => setTransfers((ts) => ts.filter((t) => t.progress < 100))}>Clear Finished</Button>
            </div>
            <div className="max-h-32 space-y-1.5 overflow-y-auto px-3 pb-2">
              {transfers.map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-xs">
                  {t.dir === 'up' ? <ArrowUpFromLine size={13} className="text-muted" /> : <ArrowDownToLine size={13} className="text-muted" />}
                  <span className="w-40 truncate">{t.name}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-text/8">
                    <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${t.progress}%` }} />
                  </div>
                  <span className="w-10 text-right tabular-nums text-muted">{t.progress >= 100 ? 'Done' : `${Math.round(t.progress)}%`}</span>
                  <IconButton icon={X} size={12} label="Cancel" className="!h-5 !w-5" onClick={() => setTransfers((ts) => ts.filter((x) => x.id !== t.id))} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
