import { useEffect, useState } from 'react';

// Dummy data (random walk) until the Go side reports real system stats.
const HISTORY = 60;
const walk = (v: number, step: number, min = 0, max = 100) => Math.min(max, Math.max(min, v + (Math.random() - 0.5) * step));

type Metrics = { cpu: number[]; mem: number[]; netDown: number[]; netUp: number[] };

const initial: Metrics = {
  cpu: Array(HISTORY).fill(20),
  mem: Array(HISTORY).fill(55),
  netDown: Array(HISTORY).fill(2),
  netUp: Array(HISTORY).fill(0.5),
};

const baseProcesses = [
  { pid: 4120, name: 'node', cpu: 18.2, mem: 612 },
  { pid: 8832, name: 'go', cpu: 9.4, mem: 240 },
  { pid: 1204, name: 'docker-desktop', cpu: 6.1, mem: 1830 },
  { pid: 5521, name: 'postgres', cpu: 2.3, mem: 310 },
  { pid: 9910, name: 'claude', cpu: 1.8, mem: 190 },
  { pid: 3302, name: 'shellmoor', cpu: 1.2, mem: 145 },
  { pid: 7781, name: 'chrome', cpu: 0.9, mem: 2210 },
];

function Sparkline({ data, max, color = 'var(--color-accent)' }: { data: number[]; max: number; color?: string }) {
  const points = data.map((v, i) => `${(i / (data.length - 1)) * 100},${30 - (v / max) * 30}`).join(' ');
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-10 w-full">
      <polyline points={`0,30 ${points} 100,30`} fill={color} fillOpacity={0.12} stroke="none" />
      <polyline points={points} fill="none" stroke={color} strokeWidth={1} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Card({ title, value, children }: { title: string; value: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wide text-muted">{title}</span>
        <span className="font-mono text-text">{value}</span>
      </div>
      {children}
    </div>
  );
}

type SortKey = 'cpu' | 'mem';

export default function Monitor() {
  const [m, setM] = useState(initial);
  const [procs, setProcs] = useState(baseProcesses);
  const [sort, setSort] = useState<SortKey>('cpu');

  useEffect(() => {
    const id = setInterval(() => {
      setM((p) => ({
        cpu: [...p.cpu.slice(1), walk(p.cpu.at(-1)!, 15)],
        mem: [...p.mem.slice(1), walk(p.mem.at(-1)!, 2, 40, 90)],
        netDown: [...p.netDown.slice(1), walk(p.netDown.at(-1)!, 2, 0, 20)],
        netUp: [...p.netUp.slice(1), walk(p.netUp.at(-1)!, 0.6, 0, 5)],
      }));
      setProcs((ps) => ps.map((p) => ({ ...p, cpu: walk(p.cpu, 3, 0, 60) })));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const cpu = m.cpu.at(-1)!;
  const mem = m.mem.at(-1)!;
  const sorted = [...procs].sort((a, b) => b[sort] - a[sort]);

  return (
    <div className="h-full overflow-auto p-3 text-sm">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        <Card title="CPU" value={`${cpu.toFixed(0)}%`}>
          <Sparkline data={m.cpu} max={100} color={cpu > 80 ? '#f87171' : undefined} />
          <div className="text-xs text-muted">12 cores · 3.6 GHz</div>
        </Card>
        <Card title="Memory" value={`${((mem / 100) * 32).toFixed(1)} / 32 GB`}>
          <Sparkline data={m.mem} max={100} />
          <div className="text-xs text-muted">swap 0.4 GB</div>
        </Card>
        <Card title="Network" value={`↓${m.netDown.at(-1)!.toFixed(1)} ↑${m.netUp.at(-1)!.toFixed(1)} MB/s`}>
          <Sparkline data={m.netDown} max={20} />
          <div className="text-xs text-muted">Wi-Fi · 192.168.1.42</div>
        </Card>
        <Card title="Disk" value="412 / 1000 GB">
          <div className="my-3 h-2 overflow-hidden rounded bg-bg">
            <div className="h-full bg-accent" style={{ width: '41.2%' }} />
          </div>
          <div className="text-xs text-muted">C:\ · read 12 MB/s · write 3 MB/s</div>
        </Card>
      </div>

      <div className="mt-4 rounded-md border border-border">
        <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
          <span className="text-xs uppercase tracking-wide text-muted">Processes</span>
          <span className="text-xs text-muted">uptime 3d 4h · load 1.42</span>
        </div>
        <table className="w-full text-left">
          <thead className="text-xs text-muted">
            <tr>
              <th className="px-3 py-1 font-normal">PID</th>
              <th className="px-3 py-1 font-normal">Name</th>
              {(['cpu', 'mem'] as const).map((k) => (
                <th key={k} onClick={() => setSort(k)} className={`cursor-pointer px-3 py-1 font-normal ${sort === k ? 'text-accent' : 'hover:text-text'}`}>
                  {k === 'cpu' ? 'CPU %' : 'Mem MB'} {sort === k && '▾'}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.pid} className="group hover:bg-bg">
                <td className="px-3 py-0.5 font-mono text-xs text-muted">{p.pid}</td>
                <td className="px-3 py-0.5 text-text">{p.name}</td>
                <td className="px-3 py-0.5 font-mono text-xs text-text">{p.cpu.toFixed(1)}</td>
                <td className="px-3 py-0.5 font-mono text-xs text-text">{p.mem}</td>
                <td className="px-3 py-0.5 text-right">
                  <button className="text-xs text-muted opacity-0 group-hover:opacity-100 hover:text-red-400">kill</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
