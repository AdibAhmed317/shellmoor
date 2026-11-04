import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import '@xterm/xterm/css/xterm.css';
import { Events } from '@wailsio/runtime';
import { ArrowDown, ArrowUp, CaseSensitive, ClipboardPaste, Copy, Eraser, Search, TextSelect, X } from 'lucide-react';
import { WriteInput, StartTerminal, Resize } from '../../bindings/github.com/AdibAhmed317/shellmoor/internal/services/terminalservice';
import type { PanelProps } from '../panels/registry';
import { useTheme } from '../store/theme';
import { profileById, useProfiles } from '../store/profiles';
import { useSettings } from '../store/settings';
import { useWorkspace } from '../store/workspace';
import { contextMenu } from '../store/overlays';
import { copyText, readText } from '../backend';
import { themeById, xtermTheme } from '../themes';
import { IconButton } from '../ui';

// Per-pane handles so commands (palette, shortcuts, menus) can act on the focused terminal.
export type TerminalApi = { focus: () => void; clear: () => void; find: () => void; copy: () => void; paste: () => void; selectAll: () => void; write: (text: string) => void };
export const terminals = new Map<string, TerminalApi>();

// Opens a new terminal tab with a command typed in (not run), e.g. docker exec / kubectl exec.
export function openTerminalWith(command: string) {
  const ws = useWorkspace.getState();
  ws.addTab('terminal');
  const { tabs, activeTabId } = useWorkspace.getState();
  const id = tabs.find((t) => t.id === activeTabId)!.activePanelId;
  const tryWrite = (attempts: number) => {
    const t = terminals.get(id);
    if (t) t.write(command);
    else if (attempts) setTimeout(() => tryWrite(attempts - 1), 100); // the pane mounts on the next render
  };
  tryWrite(20);
}

// TODO(backend): the Go side has a single PTY, so every terminal pane mirrors the same shell
// and the profile's shell/args/cwd/env are not used yet. Once sessions exist, pass panelId and
// the profile to StartTerminal and filter pty:data by panelId.
export default function Terminal({ panelId, profileId }: PanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<{ term: XTerm; fit: () => void; search: SearchAddon } | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [results, setResults] = useState<{ index: number; count: number } | null>(null);
  const [flash, setFlash] = useState(false); // visual bell
  const findRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollback, copyOnSelect } = useSettings.getState();
    const term = new XTerm({ allowProposedApi: true, scrollback }); // proposed API: search match decorations
    const fitAddon = new FitAddon();
    const search = new SearchAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(search);
    term.open(container);
    search.onDidChangeResults((r) => setResults(r.resultCount ? { index: r.resultIndex + 1, count: r.resultCount } : { index: 0, count: 0 }));

    const fit = () => {
      if (container.offsetWidth === 0) return; // hidden tab
      fitAddon.fit();
      Resize(term.cols, term.rows);
    };
    termRef.current = { term, fit, search };

    // Listen before starting so no early output is missed.
    const unsubscribe = Events.On('pty:data', (event) => term.write(event.data));
    StartTerminal();
    term.onData((data) => WriteInput(data));
    term.onSelectionChange(() => copyOnSelect && term.hasSelection() && copyText(term.getSelection()));
    term.onBell(() => {
      const { bell } = useSettings.getState();
      if (bell === 'visual') {
        setFlash(true);
        setTimeout(() => setFlash(false), 150);
      } // 'sound': the webview plays nothing by itself. TODO(backend): system beep if wanted.
    });

    const api: TerminalApi = {
      focus: () => term.focus(),
      clear: () => term.clear(),
      find: () => {
        setFindOpen(true);
        setTimeout(() => findRef.current?.select());
      },
      copy: () => term.hasSelection() && copyText(term.getSelection()),
      paste: async () => term.paste(await readText()),
      selectAll: () => term.selectAll(),
      write: (text) => (WriteInput(text), term.focus()),
    };
    terminals.set(panelId, api);

    // Panels resize independently of the window (split drag, tab switch), so observe the container.
    const observer = new ResizeObserver(fit);
    observer.observe(container);

    return () => {
      terminals.delete(panelId);
      observer.disconnect();
      unsubscribe();
      term.dispose();
      termRef.current = null;
    };
  }, [panelId]);

  // Apply the profile's look now and whenever the profile or app theme changes.
  useEffect(() => {
    const apply = () => {
      const t = termRef.current;
      if (!t || !containerRef.current) return;
      const p = profileById(profileId);
      const theme = themeById(p.themeId ?? useTheme.getState().previewId ?? useTheme.getState().themeId);
      Object.assign(t.term.options, {
        theme: xtermTheme(theme),
        fontFamily: `"${p.fontFamily}", Consolas, monospace`,
        fontSize: p.fontSize,
        cursorStyle: p.cursorStyle,
        cursorBlink: p.cursorBlink,
      });
      containerRef.current.style.background = theme.bg;
      t.fit(); // font size changes the cell grid
    };
    apply();
    const unsubTheme = useTheme.subscribe(apply);
    const unsubProfiles = useProfiles.subscribe(apply);
    return () => {
      unsubTheme();
      unsubProfiles();
    };
  }, [profileId]);

  const accent = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() || '#5fd4b0';
  const find = (next: boolean, q = query) => {
    const s = termRef.current?.search;
    if (!s) return;
    const opts = { caseSensitive, decorations: { matchBackground: `${accent}40`, activeMatchBackground: accent, matchOverviewRuler: accent, activeMatchColorOverviewRuler: accent } };
    if (!q) return (s.clearDecorations(), setResults(null));
    if (next) s.findNext(q, opts);
    else s.findPrevious(q, opts);
  };
  const closeFind = () => {
    setFindOpen(false);
    termRef.current?.search.clearDecorations();
    setResults(null);
    termRef.current?.term.focus();
  };

  const api = () => terminals.get(panelId)!;
  const onContextMenu = (e: MouseEvent) => {
    if (useSettings.getState().rightClick === 'paste') return (e.preventDefault(), api().paste());
    const hasSelection = !!termRef.current?.term.hasSelection();
    contextMenu(e, [
      { label: 'Copy', icon: Copy, disabled: !hasSelection, onSelect: api().copy },
      { label: 'Paste', icon: ClipboardPaste, onSelect: api().paste },
      { label: 'Select All', icon: TextSelect, onSelect: api().selectAll },
      'separator',
      { label: 'Find…', icon: Search, onSelect: api().find },
      { label: 'Clear', icon: Eraser, onSelect: api().clear },
    ]);
  };

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} onContextMenu={onContextMenu} className={`h-full w-full p-2 transition-[filter] ${flash ? 'brightness-150' : ''}`} />
      {findOpen && (
        <div className="glass absolute right-3 top-2 z-10 flex animate-pop items-center gap-1 rounded-xl py-1 pl-2.5 pr-1">
          <Search size={13} className="text-muted" />
          <input
            ref={findRef}
            autoFocus
            value={query}
            placeholder="Find"
            onChange={(e) => (setQuery(e.target.value), find(true, e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') find(!e.shiftKey);
              if (e.key === 'Escape') closeFind();
            }}
            className="h-6 w-44 bg-transparent text-text outline-none placeholder:text-muted/70"
          />
          <span className="w-12 text-right text-[11px] tabular-nums text-muted">{results ? (results.count ? `${results.index}/${results.count}` : 'None') : ''}</span>
          <IconButton icon={CaseSensitive} label="Match case" active={caseSensitive} size={14} className="!h-6 !w-6" onClick={() => setCaseSensitive(!caseSensitive)} />
          <IconButton icon={ArrowUp} label="Previous (Shift+Enter)" size={13} className="!h-6 !w-6" onClick={() => find(false)} />
          <IconButton icon={ArrowDown} label="Next (Enter)" size={13} className="!h-6 !w-6" onClick={() => find(true)} />
          <IconButton icon={X} label="Close (Esc)" size={13} className="!h-6 !w-6" onClick={closeFind} />
        </div>
      )}
    </div>
  );
}
