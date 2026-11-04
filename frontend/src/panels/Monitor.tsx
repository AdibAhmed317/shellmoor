import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { create } from 'zustand';
import { ChevronDown, Cpu, HardDrive, LayoutGrid, Laptop, MemoryStick, Network, Search, Server, ServerOff, X, type LucideIcon } from 'lucide-react';
import { address, useHosts, type Host, type Proc } from '../store/hosts';
import { useWorkspace } from '../store/workspace';
import { confirm, toast } from '../store/overlays';
import { Badge, EmptyState, IconButton, StatusDot, Toolbar, row, td, th, wideOnly } from '../ui';

// TODO(backend): dummy data (random walk) until the Go side reports real stats: gopsutil locally, an agent or SSH for remotes.
type Machine = Pick<Host, 'name' | 'online' | 'group' | 'os' | 'cores' | 'memGb' | 'diskGb' | 'diskUsedGb' | 'cpuBase' | 'procs'> & { id: string; subtitle: string; local?: boolean };

// Which machine Activity shows. Module-level so other panels can deep-link (Remote Hosts → "Show Activity").
const useView = create<{ view: string }>(() => ({ view: 'local' })); // a machine id, or 'all'

export function showHostActivity(hostId: string) {
  useView.setState({ view: hostId });
  useWorkspace.getState().openTool('monitor');
}

const local: Machine = {
  id: 'local', name: 'This Computer', subtitle: 'Local machine', local: true, online: true, group: 'Local',
  os: navigator.userAgent.includes('Windows') ? 'Windows 11' : navigator.userAgent.includes('Mac') ? 'macOS' : 'Linux',
  cores: 12, memGb: 32, diskGb: 1000, diskUsedGb: 412, cpuBase: 20,
  procs: [
    { pid: 4120, name: 'node', cpu: 18.2, mem: 612 },
    { pid: 8832, name: 'go', cpu: 9.4, mem: 240 },
    { pid: 1204, name: 'docker-desktop', cpu: 6.1, mem: 1830 },
    { pid: 5521, name: 'postgres', cpu: 2.3, mem: 310 },
    { pid: 9910, name: 'claude', cpu: 1.8, mem: 190 },
    { pid: 3302, name: 'shellmoor', cpu: 1.2, mem: 145 },
    { pid: 7781, name: 'chrome', cpu: 0.9, mem: 2210 },
  ],
};

const useMachines = () => {
  const hosts = useHosts((s) => s.hosts);
  return useMemo<Machine[]>(() => [local, ...hosts.map((h) => ({ ...h, subtitle: address(h) }))], [hosts]);
};

const HISTORY = 60;
const walk = (v: number, step: number, min = 0, max = 100) => Math.min(max, Math.max(min, v + (Math.random() - 0.5) * step));
// Drifts back toward a machine's typical level so each host keeps its own character.
const pull = (v: number, base: number, step: number) => walk(v + (base - v) * 0.08, step);

type Live = { cpu: number[]; mem: number[]; netDown: number[]; netUp: number[]; procs: Proc[] };

const memBase = (m: Machine) => Math.min(88, 30 + m.cpuBase * 0.6);

function seed(m: Machine): Live {
  const series = (base: number, step: number, max: number) =>
    Array.from({ length: HISTORY }).reduce<number[]>((acc) => [...acc, Math.min(max, pull(acc.at(-1) ?? base, base, step))], []);
  return { cpu: series(m.cpuBase, 14, 100), mem: series(memBase(m), 2, 100), netDown: series(m.cpuBase / 8, 2, 40), netUp: series(m.cpuBase / 20, 0.6, 20), procs: m.procs };
}

function tick(m: Machine, l: Live): Live {
  const next = (s: number[], base: number, step: number, max: number) => [...s.slice(1), Math.min(max, pull(s.at(-1)!, base, step))];
  return {
    cpu: next(l.cpu, m.cpuBase, 14, 100),
    mem: next(l.mem, memBase(m), 2, 100),
    netDown: next(l.netDown, m.cpuBase / 8, 2, 40),
    netUp: next(l.netUp, m.cpuBase / 20, 0.6, 20),
    procs: l.procs.map((p) => ({ ...p, cpu: walk(p.cpu, 3, 0, 100) })),
  };
}

const gb = (mb: number) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`);
const cpuColor = (v: number) => (v > 80 ? 'var(--color-danger)' : v > 60 ? 'var(--color-warning)' : 'var(--color-accent)');

function Sparkline({ data, max, color, className = 'mt-2 h-12' }: { data: number[]; max: number; color: string; className?: string }) {
  const points = data.map((v, i) => `${(i / (data.length - 1)) * 100},${30 - (v / max) * 28}`).join(' ');
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={`w-full ${className}`}>
      <polyline points={`0,30 ${points} 100,30`} fill={color} fillOpacity={0.12} stroke="none" />
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

function Meter({ label, value, pct }: { label: string; value: string; pct: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] text-muted">
        <span>{label}</span>
        <span className="tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-text/8">
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: cpuColor(pct) }} />
      </div>
    </div>
  );
}

function Card({ icon: Icon, title, value, detail, children }: { icon: LucideIcon; title: string; value: string; detail: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface/60 p-3.5">
      <div className="flex items-center gap-1.5 text-xs text-muted">
        <Icon size={13} strokeWidth={1.75} />
        {title}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums tracking-tight">{value}</div>
      {children}
      <div className="mt-1 text-[11px] text-muted">{detail}</div>
    </div>
  );
}

// ---------- Host picker ----------

const machineIcon = (m: Machine) => (m.local ? Laptop : m.online ? Server : ServerOff);

function HostPicker({ machines, view, onChange }: { machines: Machine[]; view: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = machines.find((m) => m.id === view);
  const Icon = current ? machineIcon(current) : LayoutGrid;
  const groups = [...new Set(machines.filter((m) => !m.local).map((m) => m.group))];
  const pick = (id: string) => (onChange(id), setOpen(false));
  const item = (selected: boolean) => `flex h-7 w-full items-center gap-2.5 rounded-md px-2.5 text-left ${selected ? 'bg-text/10' : ''} hover:bg-accent hover:text-bg`;

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex h-7 items-center gap-2 rounded-lg px-2 font-medium hover:bg-text/8">
        <Icon size={14} strokeWidth={1.9} className="text-accent" />
        {current?.name ?? 'All Hosts'}
        <ChevronDown size={12} className="text-muted" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onMouseDown={() => setOpen(false)} />
          <div className="glass absolute left-0 top-full z-40 mt-1.5 max-h-96 w-64 animate-pop overflow-y-auto rounded-xl p-1.5">
            <button className={item(view === 'all')} onClick={() => pick('all')}>
              <LayoutGrid size={14} />
              <span className="flex-1">All Hosts</span>
              <span className="text-[11px] opacity-60">{machines.length}</span>
            </button>
            <button className={item(view === 'local')} onClick={() => pick('local')}>
              <Laptop size={14} />
              This Computer
            </button>
            {groups.map((g) => (
              <div key={g}>
                <div className="px-2.5 pb-0.5 pt-2 text-[11px] font-semibold text-muted">{g}</div>
                {machines.filter((m) => !m.local && m.group === g).map((m) => (
                  <button key={m.id} className={item(view === m.id)} onClick={() => pick(m.id)}>
                    <StatusDot tone={m.online ? 'success' : 'neutral'} />
                    <span className="flex-1">{m.name}</span>
                    {!m.online && <span className="text-[11px] opacity-60">offline</span>}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Fleet overview ----------

function HostCard({ m, live, onOpen }: { m: Machine; live?: Live; onOpen: () => void }) {
  const Icon = machineIcon(m);
  const cpu = live?.cpu.at(-1) ?? 0;
  const mem = live?.mem.at(-1) ?? 0;
  const disk = (m.diskUsedGb / m.diskGb) * 100;
  const hot = cpu > 80;

  return (
    <button
      onClick={onOpen}
      className={`rounded-xl border bg-surface/60 p-3.5 text-left transition hover:bg-text/5 ${hot ? 'border-danger/50' : 'border-border'} ${m.online ? '' : 'opacity-60'}`}
    >
      <div className="flex items-center gap-2">
        <Icon size={15} strokeWidth={1.75} className={m.online ? 'text-accent' : 'text-muted'} />
        <span className="flex-1 truncate font-semibold">{m.name}</span>
        {m.group === 'Production' && <Badge tone="danger">PROD</Badge>}
        <StatusDot tone={!m.online ? 'neutral' : hot ? 'danger' : 'success'} />
      </div>
      <div className="mt-0.5 truncate text-[11px] text-muted">
        {m.os} · {m.cores} cores · {m.memGb} GB
      </div>

      {m.online && live ? (
        <>
          <div className="mt-3 flex items-end justify-between">
            <span className="text-[11px] text-muted">CPU</span>
            <span className="text-lg font-semibold tabular-nums leading-none" style={{ color: hot ? 'var(--color-danger)' : undefined }}>
              {cpu.toFixed(0)}%
            </span>
          </div>
          <Sparkline data={live.cpu} max={100} color={cpuColor(cpu)} className="mt-1 h-8" />
          <div className="mt-2 space-y-2">
            <Meter label="Memory" value={`${((mem / 100) * m.memGb).toFixed(1)} / ${m.memGb} GB`} pct={mem} />
            <Meter label="Disk" value={`${m.diskUsedGb} / ${m.diskGb} GB`} pct={disk} />
          </div>
        </>
      ) : (
        <div className="mt-4 flex h-[118px] items-center justify-center rounded-lg bg-text/4 text-xs text-muted">Unreachable · last seen 2 h ago</div>
      )}
    </button>
  );
}

// ---------- One machine ----------

function Detail({ m, live, onQuit }: { m: Machine; live?: Live; onQuit: (p: Proc) => void }) {
  const [sort, setSort] = useState<'cpu' | 'mem'>('cpu');
  const [query, setQuery] = useState('');

  if (!m.online || !live) {
    return <EmptyState icon={ServerOff} title={`${m.name} is unreachable`} body={`${m.subtitle} hasn't responded since 2 hours ago. Activity will appear when it's back online.`} />;
  }

  const cpu = live.cpu.at(-1)!;
  const mem = live.mem.at(-1)!;
  const shown = live.procs.filter((p) => p.name.includes(query.toLowerCase())).sort((a, b) => b[sort] - a[sort]);

  return (
    <div className="p-3">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
        <Card icon={Cpu} title="CPU" value={`${cpu.toFixed(0)}%`} detail={`${m.cores} cores`}>
          <Sparkline data={live.cpu} max={100} color={cpuColor(cpu)} />
        </Card>
        <Card icon={MemoryStick} title="Memory" value={`${((mem / 100) * m.memGb).toFixed(1)} GB`} detail={`of ${m.memGb} GB`}>
          <Sparkline data={live.mem} max={100} color="var(--color-accent)" />
        </Card>
        <Card icon={Network} title="Network" value={`${live.netDown.at(-1)!.toFixed(1)} MB/s`} detail={`↑ ${live.netUp.at(-1)!.toFixed(1)} MB/s`}>
          <Sparkline data={live.netDown} max={40} color="var(--color-accent)" />
        </Card>
        <Card icon={HardDrive} title="Disk" value={`${m.diskUsedGb} GB`} detail={`of ${m.diskGb >= 1000 ? `${m.diskGb / 1000} TB` : `${m.diskGb} GB`}`}>
          <div className="mt-2 flex h-12 items-center">
            <div className="h-2 w-full overflow-hidden rounded-full bg-text/8">
              <div className="h-full rounded-full" style={{ width: `${(m.diskUsedGb / m.diskGb) * 100}%`, background: cpuColor((m.diskUsedGb / m.diskGb) * 100) }} />
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border">
        <div className="flex h-10 items-center gap-2 border-b border-border px-3">
          <span className="flex-1 font-medium">Processes</span>
          <div className="flex h-7 w-48 items-center gap-1.5 rounded-md bg-text/6 px-2">
            <Search size={12} className="text-muted" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter" className="min-w-0 flex-1 bg-transparent outline-none" />
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr>
              <th className={th}>Name</th>
              <th className={`${th} ${wideOnly}`}>PID</th>
              {(['cpu', 'mem'] as const).map((k) => (
                <th key={k} onClick={() => setSort(k)} className={`${th} cursor-pointer text-right ${sort === k ? '!text-text' : 'hover:text-text'}`}>
                  {k === 'cpu' ? '% CPU' : 'Memory'} {sort === k && '↓'}
                </th>
              ))}
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.pid} className={`${row} group`}>
                <td className={`${td} font-medium`}>{p.name}</td>
                <td className={`${td} font-mono text-xs text-muted ${wideOnly}`}>{p.pid}</td>
                <td className={`${td} text-right tabular-nums`}>{p.cpu.toFixed(1)}</td>
                <td className={`${td} text-right tabular-nums`}>{gb(p.mem)}</td>
                <td className={`${td} w-10 text-right`}>
                  <IconButton icon={X} size={13} label="Quit process" className="opacity-0 hover:!text-danger group-hover:opacity-100" onClick={() => onQuit(p)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Monitor() {
  const machines = useMachines();
  const view = useView((s) => s.view);
  const setView = (v: string) => useView.setState({ view: v });
  // Seeded before first paint, or every host would flash "unreachable" for a frame.
  const [live, setLive] = useState<Record<string, Live>>(() => Object.fromEntries(machines.filter((m) => m.online).map((m) => [m.id, seed(m)])));

  // ponytail: simulates every online machine each second; with real data, poll only the visible host(s).
  useEffect(() => {
    const step = () =>
      setLive((l) => Object.fromEntries(machines.filter((m) => m.online).map((m) => [m.id, l[m.id] ? tick(m, l[m.id]) : seed(m)])));
    const id = setInterval(step, 1000);
    return () => clearInterval(id);
  }, [machines]);

  const m = machines.find((x) => x.id === view);
  const online = machines.filter((x) => x.online).length;
  const hot = machines.filter((x) => (live[x.id]?.cpu.at(-1) ?? 0) > 80).length;

  // TODO(backend): send the signal (local) or `kill` over SSH (remote).
  const quit = async (p: Proc) => {
    if (!m) return;
    const remote = !m.local;
    const ok = await confirm({
      title: `Quit “${p.name}”?`,
      message: `${remote ? `On ${m.name}${m.group === 'Production' ? ' (production)' : ''}. ` : ''}Unsaved work in this process will be lost.`,
      confirmLabel: 'Quit Process',
      destructive: true,
    });
    if (!ok) return;
    setLive((l) => ({ ...l, [m.id]: { ...l[m.id], procs: l[m.id].procs.filter((x) => x.pid !== p.pid) } }));
    toast(`Quit ${p.name}`, { description: `PID ${p.pid}${remote ? ` on ${m.name}` : ''}` });
  };

  return (
    <div className="flex h-full flex-col">
      {/* overflow-visible: the shared toolbar clips overflow, which would hide the host menu. */}
      <Toolbar className="!overflow-visible">
        <HostPicker machines={machines} view={view} onChange={setView} />
        {m ? (
          <>
            {m.group === 'Production' && <Badge tone="danger">PRODUCTION</Badge>}
            <span className={`truncate text-xs text-muted ${wideOnly}`}>
              {m.subtitle} · {m.os}
            </span>
          </>
        ) : (
          <span className="truncate text-xs text-muted">
            {online} of {machines.length} online{hot ? ` · ${hot} under high load` : ''}
          </span>
        )}
        <span className="flex-1" />
        <span className={`flex items-center gap-1.5 text-[11px] text-muted ${wideOnly}`}>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          Live
        </span>
      </Toolbar>
      <div className="min-h-0 flex-1 overflow-auto">
        {m ? (
          <Detail key={m.id} m={m} live={live[m.id]} onQuit={quit} />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3 p-3">
            {machines.map((x) => (
              <HostCard key={x.id} m={x} live={live[x.id]} onOpen={() => setView(x.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
