import { useState } from 'react';

// Dummy data until the Go side talks to the Docker engine.
const containers = [
  { id: 'a1b2c3', name: 'api', image: 'myapp/api:1.4.2', status: 'running', ports: '8080→8080', cpu: '2.1%', mem: '148 MB' },
  { id: 'd4e5f6', name: 'postgres', image: 'postgres:16', status: 'running', ports: '5432→5432', cpu: '0.4%', mem: '62 MB' },
  { id: 'g7h8i9', name: 'redis', image: 'redis:7-alpine', status: 'running', ports: '6379→6379', cpu: '0.1%', mem: '8 MB' },
  { id: 'j0k1l2', name: 'worker', image: 'myapp/worker:1.4.2', status: 'exited', ports: '-', cpu: '-', mem: '-' },
];

const images = [
  { repo: 'myapp/api', tag: '1.4.2', size: '212 MB', created: '2h ago' },
  { repo: 'postgres', tag: '16', size: '432 MB', created: '3w ago' },
  { repo: 'redis', tag: '7-alpine', size: '41 MB', created: '1mo ago' },
];

const logs = `2026-11-02T09:14:01Z INFO  server listening on :8080
2026-11-02T09:14:02Z INFO  connected to postgres
2026-11-02T09:15:33Z INFO  GET /health 200 1ms
2026-11-02T09:16:10Z WARN  slow query (412ms): SELECT * FROM orders
2026-11-02T09:17:45Z ERROR redis timeout after 2s, retrying`;

const logColor = (l: string) => (l.includes('ERROR') ? 'text-red-400' : l.includes('WARN') ? 'text-yellow-400' : 'text-text');

export default function Docker() {
  const [view, setView] = useState<'containers' | 'images'>('containers');
  const [selected, setSelected] = useState(containers[0].name);

  return (
    <div className="flex h-full flex-col text-sm">
      <div className="flex items-center gap-3 border-b border-border px-3 py-1.5">
        {(['containers', 'images'] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} className={`text-xs uppercase ${view === v ? 'text-accent' : 'text-muted hover:text-text'}`}>
            {v}
          </button>
        ))}
        <span className="flex-1" />
        <span className="text-xs text-muted">docker-desktop · 3 running</span>
      </div>

      {view === 'containers' ? (
        <>
          <div className="max-h-[50%] overflow-auto">
            <table className="w-full text-left">
              <thead className="text-xs text-muted">
                <tr>
                  {['', 'Name', 'Image', 'Ports', 'CPU', 'Mem', ''].map((h, i) => (
                    <th key={i} className="px-3 py-1 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {containers.map((c) => (
                  <tr key={c.id} onClick={() => setSelected(c.name)} className={`cursor-pointer hover:bg-bg ${selected === c.name ? 'bg-bg' : ''}`}>
                    <td className="pl-3"><span className={`inline-block h-2 w-2 rounded-full ${c.status === 'running' ? 'bg-accent' : 'bg-muted'}`} /></td>
                    <td className="px-3 py-1 text-text">{c.name}</td>
                    <td className="px-3 py-1 text-muted">{c.image}</td>
                    <td className="px-3 py-1 text-muted">{c.ports}</td>
                    <td className="px-3 py-1 text-muted">{c.cpu}</td>
                    <td className="px-3 py-1 text-muted">{c.mem}</td>
                    <td className="px-3 py-1 text-right text-muted">
                      <button className="px-1 hover:text-accent" title={c.status === 'running' ? 'Stop' : 'Start'}>{c.status === 'running' ? '■' : '▶'}</button>
                      <button className="px-1 hover:text-accent" title="Restart">↻</button>
                      <button className="px-1 hover:text-accent" title="Exec shell">›_</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-y border-border px-3 py-1 text-xs text-muted">logs · {selected}</div>
          <pre className="min-h-0 flex-1 overflow-auto p-3 font-mono text-xs">
            {logs.split('\n').map((l, i) => <div key={i} className={logColor(l)}>{l}</div>)}
          </pre>
        </>
      ) : (
        <table className="w-full text-left">
          <thead className="text-xs text-muted">
            <tr>
              {['Repository', 'Tag', 'Size', 'Created'].map((h) => <th key={h} className="px-3 py-1 font-normal">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {images.map((im) => (
              <tr key={im.repo + im.tag} className="hover:bg-bg">
                <td className="px-3 py-1 text-text">{im.repo}</td>
                <td className="px-3 py-1 text-accent">{im.tag}</td>
                <td className="px-3 py-1 text-muted">{im.size}</td>
                <td className="px-3 py-1 text-muted">{im.created}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
