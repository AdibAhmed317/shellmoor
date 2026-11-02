import { useState } from 'react';

// Dummy data until the Go side handles SSH/SFTP.
const profiles = [
  { name: 'prod-web', host: 'deploy@10.0.1.12', port: 22, status: 'online' },
  { name: 'staging', host: 'ubuntu@staging.example.com', port: 22, status: 'online' },
  { name: 'gpu-box', host: 'ml@gpu.internal', port: 2222, status: 'offline' },
];

const remoteFiles = [
  { name: 'app/', size: '-', modified: 'Oct 30' },
  { name: 'logs/', size: '-', modified: 'Nov 2' },
  { name: 'docker-compose.yml', size: '1.2 KB', modified: 'Oct 28' },
  { name: '.env', size: '312 B', modified: 'Oct 12' },
];

export default function Ssh() {
  const [selected, setSelected] = useState(profiles[0].name);
  const [view, setView] = useState<'session' | 'sftp'>('session');
  const profile = profiles.find((p) => p.name === selected)!;

  return (
    <div className="flex h-full text-sm">
      <div className="flex w-56 shrink-0 flex-col border-r border-border">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-xs uppercase tracking-wide text-muted">Hosts</span>
          <button className="text-muted hover:text-accent" title="Add host">+</button>
        </div>
        {profiles.map((p) => (
          <div
            key={p.name}
            onClick={() => setSelected(p.name)}
            className={`cursor-pointer px-3 py-1.5 hover:bg-bg ${selected === p.name ? 'bg-bg' : ''}`}
          >
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${p.status === 'online' ? 'bg-accent' : 'bg-muted'}`} />
              <span className="text-text">{p.name}</span>
            </div>
            <div className="truncate pl-4 text-xs text-muted">{p.host}</div>
          </div>
        ))}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-border px-3 py-1.5">
          <span className="text-xs text-red-300/80 rounded border border-red-300/30 px-1.5">REMOTE</span>
          <span className="text-text">{profile.host}:{profile.port}</span>
          <span className="flex-1" />
          {(['session', 'sftp'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`text-xs uppercase ${view === v ? 'text-accent' : 'text-muted hover:text-text'}`}
            >
              {v}
            </button>
          ))}
          <button className="rounded bg-accent/90 px-3 py-0.5 text-bg hover:bg-accent">Connect</button>
        </div>

        {view === 'session' ? (
          <pre className="min-h-0 flex-1 overflow-auto p-3 font-mono text-xs text-text">
            {`Welcome to Ubuntu 24.04 LTS\n\nLast login: Sun Nov  1 21:04:11 2026\n`}
            <span className="text-accent">{profile.host}</span>
            {':~$ '}
            <span className="animate-pulse">▋</span>
          </pre>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="border-b border-border px-3 py-1 text-xs text-muted">/home/{profile.host.split('@')[0]}</div>
            <table className="w-full text-left">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="px-3 py-1 font-normal">Name</th>
                  <th className="px-3 py-1 font-normal">Size</th>
                  <th className="px-3 py-1 font-normal">Modified</th>
                </tr>
              </thead>
              <tbody>
                {remoteFiles.map((f) => (
                  <tr key={f.name} className="cursor-pointer hover:bg-bg">
                    <td className="px-3 py-0.5 text-text">{f.name}</td>
                    <td className="px-3 py-0.5 text-muted">{f.size}</td>
                    <td className="px-3 py-0.5 text-muted">{f.modified}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
