// Searchable command history.
// TODO(backend): fill from shell integration (OSC 133 / preexec hooks) so entries carry real cwd, exit code and duration.
import { create } from 'zustand';

export type HistoryEntry = { id: number; command: string; cwd: string; at: number; exitCode: number; durationMs: number; host: string };

const min = 60_000;
const now = Date.now();
const seed: [string, string, number, number, number, string][] = [
  ['npm run dev', '~/projects/my-project', 2 * min, 0, 412_000, 'local'],
  ['git status', '~/projects/my-project', 5 * min, 0, 80, 'local'],
  ['docker compose up -d', '~/projects/my-project', 12 * min, 0, 8_200, 'local'],
  ['go test ./...', '~/projects/shellmoor', 30 * min, 1, 14_300, 'local'],
  ['kubectl get pods -n payments', '~', 45 * min, 0, 900, 'local'],
  ['kubectl logs worker-5b6d7-hh2j9 -n payments', '~', 46 * min, 0, 1_100, 'local'],
  ['ssh deploy@10.0.1.12', '~', 60 * min, 0, 3_600_000, 'local'],
  ['sudo systemctl restart nginx', '/etc/nginx', 62 * min, 0, 1_400, 'prod-web'],
  ['tail -f /var/log/nginx/error.log', '/var/log/nginx', 64 * min, 130, 600_000, 'prod-web'],
  ['psql -U postgres -c "select count(*) from orders"', '~', 3 * 60 * min, 0, 2_300, 'prod-db'],
  ['git pull --rebase', '~/projects/my-project', 5 * 60 * min, 0, 2_100, 'local'],
  ['npm install', '~/projects/my-project', 26 * 60 * min, 0, 31_000, 'local'],
  ['python scripts/deploy.py staging', '~/projects/my-project', 28 * 60 * min, 2, 9_800, 'local'],
];

export const useHistory = create<{ entries: HistoryEntry[] }>(() => ({
  entries: seed.map(([command, cwd, ago, exitCode, durationMs, host], i) => ({ id: i, command, cwd, at: now - ago, exitCode, durationMs, host })),
}));

export function formatAgo(at: number) {
  const s = Math.round((Date.now() - at) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}
