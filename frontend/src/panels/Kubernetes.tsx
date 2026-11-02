import { useState } from 'react';

// Dummy data until the Go side talks to the cluster (kubeconfig).
const contexts = ['prod-eks', 'staging-gke', 'kind-local'];
const namespaces = ['default', 'payments', 'monitoring'];

const pods = [
  { name: 'api-7f9c8d-x2k4p', ready: '1/1', status: 'Running', restarts: 0, age: '3d', node: 'ip-10-0-1-12' },
  { name: 'api-7f9c8d-q8m1z', ready: '1/1', status: 'Running', restarts: 1, age: '3d', node: 'ip-10-0-1-34' },
  { name: 'worker-5b6d7-hh2j9', ready: '0/1', status: 'CrashLoopBackOff', restarts: 14, age: '42m', node: 'ip-10-0-1-12' },
  { name: 'migrate-job-8tq2r', ready: '0/1', status: 'Completed', restarts: 0, age: '3d', node: 'ip-10-0-1-34' },
];

const describe = `Name:         worker-5b6d7-hh2j9
Namespace:    payments
Status:       CrashLoopBackOff
Image:        myapp/worker:1.4.2
Events:
  Warning  BackOff  2m (x14 over 42m)  kubelet  Back-off restarting failed container
  Normal   Pulled   2m                 kubelet  Container image already present`;

const statusColor = (s: string) =>
  s === 'Running' ? 'text-accent' : s === 'Completed' ? 'text-muted' : 'text-red-400';

export default function Kubernetes() {
  const [ctx, setCtx] = useState(contexts[0]);
  const [ns, setNs] = useState(namespaces[1]);
  const [selected, setSelected] = useState(pods[2].name);
  const [tab, setTab] = useState<'describe' | 'logs'>('describe');

  const select = 'rounded border border-border bg-bg px-2 py-0.5 text-text outline-none';

  return (
    <div className="flex h-full flex-col text-sm">
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-xs">
        <span className="text-muted">context</span>
        <select value={ctx} onChange={(e) => setCtx(e.target.value)} className={select}>
          {contexts.map((c) => <option key={c}>{c}</option>)}
        </select>
        <span className="text-muted">namespace</span>
        <select value={ns} onChange={(e) => setNs(e.target.value)} className={select}>
          {namespaces.map((n) => <option key={n}>{n}</option>)}
        </select>
        <span className="flex-1" />
        {ctx.startsWith('prod') && <span className="rounded border border-red-300/30 px-1.5 text-red-300/80">PRODUCTION</span>}
      </div>

      <div className="max-h-[50%] overflow-auto">
        <table className="w-full text-left">
          <thead className="text-xs text-muted">
            <tr>
              {['Pod', 'Ready', 'Status', 'Restarts', 'Age', 'Node'].map((h) => <th key={h} className="px-3 py-1 font-normal">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {pods.map((p) => (
              <tr key={p.name} onClick={() => setSelected(p.name)} className={`cursor-pointer hover:bg-bg ${selected === p.name ? 'bg-bg' : ''}`}>
                <td className="px-3 py-1 font-mono text-xs text-text">{p.name}</td>
                <td className="px-3 py-1 text-muted">{p.ready}</td>
                <td className={`px-3 py-1 ${statusColor(p.status)}`}>{p.status}</td>
                <td className="px-3 py-1 text-muted">{p.restarts}</td>
                <td className="px-3 py-1 text-muted">{p.age}</td>
                <td className="px-3 py-1 text-muted">{p.node}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3 border-y border-border px-3 py-1 text-xs">
        {(['describe', 'logs'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`uppercase ${tab === t ? 'text-accent' : 'text-muted hover:text-text'}`}>
            {t}
          </button>
        ))}
        <span className="text-muted">· {selected}</span>
        <span className="flex-1" />
        <button className="text-muted hover:text-accent">port-forward</button>
        <button className="text-muted hover:text-accent">exec</button>
        <button className="text-muted hover:text-red-400">delete</button>
      </div>
      <pre className="min-h-0 flex-1 overflow-auto p-3 font-mono text-xs text-text">
        {tab === 'describe' ? describe : 'panic: redis: connection refused\n\ngoroutine 1 [running]:\nmain.main()\n\t/app/main.go:42 +0x1a5'}
      </pre>
    </div>
  );
}
