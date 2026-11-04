import { useState, type MouseEvent } from 'react';
import { ArrowLeftRight, Copy, RotateCw, ScrollText, ShipWheel, SquareTerminal, Trash } from 'lucide-react';
import { confirm, contextMenu, prompt, toast } from '../store/overlays';
import { useWorkspace } from '../store/workspace';
import { openTerminalWith } from '../components/Terminal';
import { copyText } from '../backend';
import { Badge, Button, EmptyState, Segmented, Toolbar, field, row, td, th, wideOnly, type Tone } from '../ui';

// TODO(backend): dummy cluster until the Go side talks to Kubernetes (kubeconfig). Actions change local state only.
const contexts = ['prod-eks', 'staging-gke', 'kind-local'];
const namespaces = ['default', 'payments', 'monitoring'];

type Pod = { name: string; ready: string; status: string; restarts: number; age: string; node: string };

const initialPods: Pod[] = [
  { name: 'api-7f9c8d-x2k4p', ready: '1/1', status: 'Running', restarts: 0, age: '3d', node: 'ip-10-0-1-12' },
  { name: 'api-7f9c8d-q8m1z', ready: '1/1', status: 'Running', restarts: 1, age: '3d', node: 'ip-10-0-1-34' },
  { name: 'worker-5b6d7-hh2j9', ready: '0/1', status: 'CrashLoopBackOff', restarts: 14, age: '42m', node: 'ip-10-0-1-12' },
  { name: 'migrate-job-8tq2r', ready: '0/1', status: 'Completed', restarts: 0, age: '3d', node: 'ip-10-0-1-34' },
];

const describe = (p: Pod, ns: string) => `Name:         ${p.name}
Namespace:    ${ns}
Node:         ${p.node}
Status:       ${p.status}
Restarts:     ${p.restarts}
Image:        myapp/${p.name.split('-')[0]}:1.4.2
Events:
${p.status === 'CrashLoopBackOff'
  ? '  Warning  BackOff  2m (x14 over 42m)  kubelet  Back-off restarting failed container\n  Normal   Pulled   2m                 kubelet  Container image already present'
  : '  Normal   Scheduled  3d  default-scheduler  Successfully assigned\n  Normal   Started    3d  kubelet            Started container'}`;

const logsFor = (p: Pod) =>
  p.status === 'CrashLoopBackOff'
    ? 'panic: redis: connection refused\n\ngoroutine 1 [running]:\nmain.main()\n\t/app/main.go:42 +0x1a5'
    : '{"level":"info","msg":"listening","port":8080}\n{"level":"info","msg":"GET /health","status":200,"ms":1}';

const statusTone = (s: string): Tone => (s === 'Running' ? 'success' : s === 'Completed' ? 'neutral' : s === 'Terminating' || s === 'Pending' ? 'warning' : 'danger');

export default function Kubernetes() {
  const [ctx, setCtx] = useState(contexts[0]);
  const [ns, setNs] = useState(namespaces[1]);
  const [pods, setPods] = useState(initialPods);
  const [selected, setSelected] = useState(initialPods[2].name);
  const [tab, setTab] = useState<'describe' | 'logs'>('describe');
  const isProd = ctx.startsWith('prod');
  const pod = pods.find((p) => p.name === selected) ?? pods[0];

  const exec = (p: Pod) => openTerminalWith(`kubectl --context ${ctx} -n ${ns} exec -it ${p.name} -- sh`);

  // Deleting a pod is how you restart it; the controller schedules a replacement.
  const del = async (p: Pod) => {
    const ok = await confirm({
      title: `Delete ${p.name}?`,
      message: `${isProd ? `This is the PRODUCTION cluster (${ctx}). ` : ''}Its controller will start a replacement pod.`,
      confirmLabel: 'Delete Pod',
      destructive: true,
    });
    if (!ok) return;
    setPods((ps) => ps.map((x) => (x.name === p.name ? { ...x, status: 'Terminating' } : x)));
    setTimeout(() => {
      const fresh = `${p.name.replace(/-[a-z0-9]{5}$/, '')}-${Math.random().toString(36).slice(2, 7)}`;
      setPods((ps) => ps.map((x) => (x.name === p.name ? { ...x, name: fresh, status: 'Running', ready: '1/1', restarts: 0, age: '1s' } : x)));
      setSelected(fresh);
      toast(`Deleted ${p.name}`, { description: `Replaced by ${fresh}` });
    }, 1500);
  };

  const forward = async (p: Pod) => {
    const ports = await prompt({ title: 'Port Forward', message: `local:remote for ${p.name}`, value: '8080:8080', confirmLabel: 'Forward' });
    if (!ports) return;
    toast(`Forwarding localhost:${ports.split(':')[0]}`, {
      tone: 'success',
      description: `to ${p.name}:${ports.split(':')[1] ?? ports}`,
      action: { label: 'Open in Browser', run: () => useWorkspace.getState().openTool('browser') },
    });
  };

  const podMenu = (e: MouseEvent, p: Pod) =>
    contextMenu(e, [
      { label: 'Logs', icon: ScrollText, onSelect: () => (setSelected(p.name), setTab('logs')) },
      { label: 'Exec Shell', icon: SquareTerminal, disabled: p.status !== 'Running', onSelect: () => exec(p) },
      { label: 'Port Forward…', icon: ArrowLeftRight, disabled: p.status !== 'Running', onSelect: () => forward(p) },
      { label: 'Copy Name', icon: Copy, onSelect: () => copyText(p.name) },
      'separator',
      { label: 'Delete (Restart)…', icon: RotateCw, danger: true, onSelect: () => del(p) },
    ]);

  return (
    <div className="flex h-full flex-col">
      <Toolbar>
        <select value={ctx} onChange={(e) => setCtx(e.target.value)} className={`${field} !w-auto`}>
          {contexts.map((c) => <option key={c}>{c}</option>)}
        </select>
        <span className="text-muted">/</span>
        <select value={ns} onChange={(e) => setNs(e.target.value)} className={`${field} !w-auto`}>
          {namespaces.map((n) => <option key={n}>{n}</option>)}
        </select>
        <span className="flex-1" />
        {isProd && <Badge tone="danger">PRODUCTION</Badge>}
      </Toolbar>

      {/* A thin warning stripe keeps production impossible to miss. */}
      {isProd && <div className="h-0.5 shrink-0 bg-danger/70" />}

      {pods.length === 0 ? (
        <EmptyState icon={ShipWheel} title="No pods" body={`Nothing is running in ${ns}.`} />
      ) : (
        <>
          <div className="max-h-[50%] shrink-0 overflow-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className={th}>Pod</th><th className={th}>Ready</th><th className={th}>Status</th>
                  <th className={th}>Restarts</th><th className={`${th} ${wideOnly}`}>Age</th><th className={`${th} ${wideOnly}`}>Node</th>
                </tr>
              </thead>
              <tbody>
                {pods.map((p) => (
                  <tr key={p.name} onClick={() => setSelected(p.name)} onContextMenu={(e) => podMenu(e, p)} className={`${row} ${selected === p.name ? '!bg-accent/10' : ''}`}>
                    <td className={`${td} font-mono text-xs`}>{p.name}</td>
                    <td className={`${td} tabular-nums text-muted`}>{p.ready}</td>
                    <td className={td}><Badge tone={statusTone(p.status)}>{p.status}</Badge></td>
                    <td className={`${td} tabular-nums ${p.restarts > 5 ? 'text-danger' : 'text-muted'}`}>{p.restarts}</td>
                    <td className={`${td} text-muted ${wideOnly}`}>{p.age}</td>
                    <td className={`${td} font-mono text-xs text-muted ${wideOnly}`}>{p.node}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex h-10 shrink-0 items-center gap-2 border-y border-border px-3">
            <Segmented value={tab} onChange={setTab} options={[{ value: 'describe', label: 'Describe' }, { value: 'logs', label: 'Logs' }]} />
            <span className="truncate font-mono text-xs text-muted">{pod.name}</span>
            <span className="flex-1" />
            <Button variant="ghost" icon={ArrowLeftRight} className={wideOnly} disabled={pod.status !== 'Running'} onClick={() => forward(pod)}>Port Forward</Button>
            <Button variant="ghost" icon={SquareTerminal} className={wideOnly} disabled={pod.status !== 'Running'} onClick={() => exec(pod)}>Exec</Button>
            <Button variant="danger" icon={Trash} disabled={pod.status === 'Terminating'} onClick={() => del(pod)}>Delete</Button>
          </div>
          <pre className="min-h-0 flex-1 overflow-auto p-3 font-mono text-xs leading-5 text-text">{tab === 'describe' ? describe(pod, ns) : logsFor(pod)}</pre>
        </>
      )}
    </div>
  );
}
