import { useWorkspace } from '../store/workspace';
import { useTheme } from '../store/theme';
import { themeById } from '../themes';

export default function StatusBar() {
  const tabCount = useWorkspace((s) => s.tabs.length);
  const themeName = useTheme((s) => themeById(s.themeId).name);

  return (
    <div className="flex h-6 shrink-0 items-center justify-between border-t border-border bg-surface px-3 text-xs text-muted">
      <span>local · {themeName}</span>
      <span>
        {tabCount} tab{tabCount === 1 ? '' : 's'} · Ctrl+Shift+T tab · Ctrl+Shift+D/E split · Ctrl+Shift+W close · Ctrl+Shift+[ ] theme
      </span>
    </div>
  );
}
