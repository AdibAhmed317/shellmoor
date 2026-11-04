// Saved SSH hosts, shared by Remote Hosts, Activity and the host editor.
// TODO(backend): import from ~/.ssh/config, probe reachability, and replace the simulated specs/procs
// with live data. Passwords/passphrases never live here: they go through backend.saveSecret().
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Proc = { pid: number; name: string; cpu: number; mem: number }; // mem in MB
export type Forward = { type: 'local' | 'remote' | 'dynamic'; bindPort: number; target: string }; // target "host:port", empty for dynamic

export type Host = {
  id: string;
  name: string;
  user: string;
  hostname: string;
  port: number;
  group: string;
  auth: 'agent' | 'key' | 'password';
  keyPath: string;
  jumpHost: string | null; // id of another host
  forwards: Forward[];
  keepAlive: boolean;
  autoReconnect: boolean;
  // Simulated until the backend reports real values.
  online: boolean;
  os: string;
  cores: number;
  memGb: number;
  diskGb: number;
  diskUsedGb: number;
  cpuBase: number;
  procs: Proc[];
};

export const address = (h: Pick<Host, 'user' | 'hostname'>) => `${h.user}@${h.hostname}`;

const base = { auth: 'agent' as const, keyPath: '', jumpHost: null, forwards: [], keepAlive: true, autoReconnect: true };

const seed: Host[] = [
  {
    ...base, id: 'prod-web', name: 'prod-web', user: 'deploy', hostname: '10.0.1.12', port: 22, group: 'Production', jumpHost: 'bastion',
    forwards: [{ type: 'local', bindPort: 8080, target: 'localhost:8080' }],
    online: true, os: 'Ubuntu 24.04', cores: 8, memGb: 16, diskGb: 200, diskUsedGb: 121, cpuBase: 38,
    procs: [
      { pid: 1312, name: 'node (api)', cpu: 22.4, mem: 840 },
      { pid: 988, name: 'nginx', cpu: 6.1, mem: 64 },
      { pid: 742, name: 'dockerd', cpu: 2.2, mem: 210 },
      { pid: 2210, name: 'redis-server', cpu: 1.4, mem: 120 },
      { pid: 611, name: 'sshd', cpu: 0.1, mem: 8 },
    ],
  },
  {
    ...base, id: 'prod-db', name: 'prod-db', user: 'admin', hostname: '10.0.1.30', port: 22, group: 'Production', auth: 'key', keyPath: '~/.ssh/prod_ed25519', jumpHost: 'bastion',
    forwards: [{ type: 'local', bindPort: 5433, target: 'localhost:5432' }],
    online: true, os: 'Debian 12', cores: 16, memGb: 64, diskGb: 1000, diskUsedGb: 812, cpuBase: 72,
    procs: [
      { pid: 2045, name: 'postgres', cpu: 54.2, mem: 41200 },
      { pid: 2051, name: 'postgres: autovacuum', cpu: 9.8, mem: 1800 },
      { pid: 3120, name: 'pgbouncer', cpu: 3.1, mem: 90 },
      { pid: 640, name: 'node_exporter', cpu: 0.4, mem: 22 },
      { pid: 588, name: 'sshd', cpu: 0.1, mem: 8 },
    ],
  },
  {
    ...base, id: 'bastion', name: 'bastion', user: 'ops', hostname: 'bastion.example.com', port: 22, group: 'Production',
    online: true, os: 'Amazon Linux 2023', cores: 2, memGb: 2, diskGb: 20, diskUsedGb: 6, cpuBase: 3,
    procs: [{ pid: 501, name: 'sshd', cpu: 0.8, mem: 12 }, { pid: 420, name: 'amazon-ssm-agent', cpu: 0.3, mem: 40 }],
  },
  {
    ...base, id: 'staging', name: 'staging', user: 'ubuntu', hostname: 'staging.example.com', port: 22, group: 'Staging',
    online: true, os: 'Ubuntu 22.04', cores: 4, memGb: 8, diskGb: 100, diskUsedGb: 43, cpuBase: 9,
    procs: [
      { pid: 1402, name: 'node (api)', cpu: 4.2, mem: 410 },
      { pid: 1188, name: 'dockerd', cpu: 1.1, mem: 180 },
      { pid: 990, name: 'nginx', cpu: 0.6, mem: 40 },
      { pid: 601, name: 'sshd', cpu: 0.0, mem: 7 },
    ],
  },
  {
    ...base, id: 'gpu-box', name: 'gpu-box', user: 'ml', hostname: 'gpu.internal', port: 2222, group: 'Lab', auth: 'key', keyPath: '~/.ssh/id_ed25519',
    online: false, os: 'Ubuntu 24.04', cores: 32, memGb: 128, diskGb: 4000, diskUsedGb: 2900, cpuBase: 0, procs: [],
  },
];

// Defaults for a host added in the editor; simulated as a small, idle, reachable box.
export const blankHost = (): Host => ({
  ...base, id: crypto.randomUUID(), name: '', user: '', hostname: '', port: 22, group: 'Servers',
  online: true, os: 'Linux', cores: 2, memGb: 4, diskGb: 50, diskUsedGb: 12, cpuBase: 6,
  procs: [{ pid: 1, name: 'systemd', cpu: 0.1, mem: 12 }, { pid: 600, name: 'sshd', cpu: 0.0, mem: 7 }],
});

type HostsState = {
  hosts: Host[];
  save: (host: Host) => void;
  remove: (id: string) => void;
};

export const useHosts = create<HostsState>()(
  persist(
    (set) => ({
      hosts: seed,
      save: (host) =>
        set((s) => ({ hosts: s.hosts.some((h) => h.id === host.id) ? s.hosts.map((h) => (h.id === host.id ? host : h)) : [...s.hosts, host] })),
      remove: (id) =>
        set((s) => ({ hosts: s.hosts.filter((h) => h.id !== id).map((h) => (h.jumpHost === id ? { ...h, jumpHost: null } : h)) })),
    }),
    { name: 'shellmoor-hosts' },
  ),
);
