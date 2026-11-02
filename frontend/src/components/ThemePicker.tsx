import { useState } from 'react';
import { themes } from '../themes';
import { useTheme } from '../store/theme';

export default function ThemePicker() {
  const { themeId, setTheme, setPreview } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'dark' | 'light'>('all');

  const close = () => {
    setOpen(false);
    setPreview(null);
  };

  const shown = themes.filter(
    (t) => (filter === 'all' || t.type === filter) && t.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="relative">
      <button onClick={() => (open ? close() : setOpen(true))} className="px-2 text-muted hover:text-accent" title="Theme (Ctrl+Shift+[ / ])">
        ◐
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-[26rem] rounded-md border border-border bg-surface p-2 shadow-xl" onMouseLeave={() => setPreview(null)}>
          <div className="mb-2 flex gap-2">
            <input
              autoFocus
              placeholder={`Search ${themes.length} themes…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && close()}
              className="flex-1 rounded border border-border bg-bg px-2 py-1 text-text outline-none focus:border-accent/60"
            />
            {(['all', 'dark', 'light'] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`text-xs uppercase ${filter === f ? 'text-accent' : 'text-muted hover:text-text'}`}>
                {f}
              </button>
            ))}
            <button
              onClick={() => setTheme(shown[Math.floor(Math.random() * shown.length)]?.id ?? themeId)}
              className="text-muted hover:text-accent"
              title="Random"
            >
              ⚄
            </button>
          </div>
          <div className="grid max-h-96 grid-cols-2 gap-1.5 overflow-auto pr-1">
            {shown.map((t) => (
              <button
                key={t.id}
                onMouseEnter={() => setPreview(t.id)}
                onClick={() => setTheme(t.id)}
                style={{ background: t.bg, color: t.text, borderColor: t.id === themeId ? t.accent : t.border }}
                className="rounded border-2 p-2 text-left text-xs"
              >
                <div className="flex items-center justify-between">
                  <span>{t.name}</span>
                  <span style={{ color: t.accent }}>{t.id === themeId ? '✓' : '●'}</span>
                </div>
                <div className="mt-1.5 flex h-2 overflow-hidden rounded-sm">
                  {t.ansi.slice(1, 7).map((c, i) => (
                    <span key={i} className="flex-1" style={{ background: c }} />
                  ))}
                </div>
              </button>
            ))}
            {shown.length === 0 && <div className="col-span-2 py-4 text-center text-muted">No themes match.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
