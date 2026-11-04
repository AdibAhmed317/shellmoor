import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { getCommands, keyLabel, type Command } from '../commands';
import { useTheme } from '../store/theme';
import { useUi } from '../store/ui';

// Substring matches rank above scattered-letter matches; earlier matches rank higher.
function score(title: string, q: string) {
  const t = title.toLowerCase();
  const i = t.indexOf(q);
  if (i >= 0) return 1000 - i;
  let j = 0;
  for (const ch of t) if (ch === q[j]) j++;
  return j === q.length ? 1 : -1;
}

// Spotlight-style: one big field, results underneath.
function Palette() {
  const closeSheet = useUi((s) => s.close);
  const setPreview = useTheme((s) => s.setPreview);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const all = useMemo(getCommands, []);

  const q = query.trim().toLowerCase();
  const results: Command[] = q
    ? all.filter((c) => !c.hidden).map((c) => [c, score(c.title, q)] as const).filter(([, s]) => s >= 0).sort((a, b) => b[1] - a[1]).map(([c]) => c).slice(0, 60)
    : all.filter((c) => !c.hidden && !c.searchOnly);
  const current = results[Math.min(index, results.length - 1)];

  // Highlighting a theme previews it live; anything else restores the saved theme.
  useEffect(() => {
    if (current?.preview) current.preview();
    else setPreview(null);
    listRef.current?.querySelector('[data-current]')?.scrollIntoView({ block: 'nearest' });
  }, [current, setPreview]);

  const close = () => {
    setPreview(null);
    closeSheet();
  };
  const run = (c: Command) => {
    close();
    c.run();
  };

  return (
    <div className="fixed inset-0 z-50 flex animate-fade justify-center bg-black/20 pt-[14vh]" onMouseDown={close}>
      <div onMouseDown={(e) => e.stopPropagation()} className="glass flex h-fit max-h-[62vh] w-[min(640px,92vw)] animate-pop flex-col overflow-hidden rounded-[22px]">
        <div className="flex items-center gap-3 px-5">
          <Search size={20} strokeWidth={1.75} className="text-muted" />
          <input
            autoFocus
            value={query}
            placeholder="Search commands, tools, profiles and themes"
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') setIndex((i) => Math.min(i + 1, results.length - 1));
              else if (e.key === 'ArrowUp') setIndex((i) => Math.max(i - 1, 0));
              else if (e.key === 'Enter' && current) run(current);
              else if (e.key === 'Escape') close();
              else return;
              e.preventDefault();
            }}
            className="h-14 flex-1 bg-transparent text-[20px] tracking-tight text-text outline-none placeholder:text-muted/60"
          />
        </div>
        <div ref={listRef} className="min-h-0 overflow-y-auto border-t border-border px-2 pb-2">
          {results.length === 0 && <div className="py-10 text-center text-muted">No Results</div>}
          {results.map((c, i) => {
            const showGroup = !q && c.group !== results[i - 1]?.group;
            const Icon = c.icon;
            const selected = c === current;
            return (
              <div key={c.id}>
                {showGroup && <div className="px-3 pb-1 pt-3 text-[11px] font-semibold text-muted">{c.group}</div>}
                <div
                  data-current={selected ? '' : undefined}
                  onMouseMove={() => setIndex(i)}
                  onClick={() => run(c)}
                  className={`flex h-9 items-center gap-3 rounded-[10px] px-3 ${selected ? 'bg-accent text-bg' : 'text-text'}`}
                >
                  {Icon && (
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${selected ? 'bg-bg/20' : 'bg-text/8'}`}
                      style={c.iconColor && !selected ? { color: c.iconColor } : undefined}
                    >
                      <Icon size={14} strokeWidth={1.9} />
                    </span>
                  )}
                  <span className="flex-1 truncate">{c.title}</span>
                  {q && <span className={`text-[11px] ${selected ? 'opacity-75' : 'text-muted'}`}>{c.group}</span>}
                  {c.key && <span className={`text-[11px] ${selected ? 'opacity-75' : 'text-muted'}`}>{keyLabel(c.key)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function CommandPalette() {
  const open = useUi((s) => s.sheet?.type === 'palette');
  return open ? <Palette /> : null; // remount on open so the query starts empty
}
