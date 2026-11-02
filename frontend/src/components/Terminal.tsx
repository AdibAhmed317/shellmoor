import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Events } from '@wailsio/runtime';
import { WriteInput, StartTerminal, Resize } from '../../bindings/github.com/AdibAhmed317/shellmoor/internal/services/terminalservice';
import type { PanelProps } from '../panels/registry';
import { activeTheme, useTheme } from '../store/theme';
import { xtermTheme } from '../themes';

// TODO(backend): the Go side has a single PTY, so every terminal panel mirrors the same shell.
// Once sessions exist, pass panelId to StartTerminal and filter pty:data by it.
export default function Terminal(_: PanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new XTerm({
      theme: xtermTheme(activeTheme(useTheme.getState())),
      fontFamily: 'Consolas, "Courier New", monospace',
      cursorBlink: true,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);

    // Listen before starting so no early output is missed.
    const unsubscribe = Events.On('pty:data', (event) => term.write(event.data));
    StartTerminal();
    term.onData((data) => WriteInput(data));
    const unsubTheme = useTheme.subscribe((s) => (term.options.theme = xtermTheme(activeTheme(s))));

    // Panels resize independently of the window (split drag, tab switch), so observe the container.
    const observer = new ResizeObserver(() => {
      if (container.offsetWidth === 0) return; // hidden tab
      fitAddon.fit();
      Resize(term.cols, term.rows);
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      unsubscribe();
      unsubTheme();
      term.dispose();
    };
  }, []);

  return <div ref={containerRef} className="h-full w-full p-2" />;
}
