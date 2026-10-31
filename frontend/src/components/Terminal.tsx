import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Events } from '@wailsio/runtime';
// Import both functions
import {
  WriteInput,
  StartTerminal,
  Resize,
} from '../../../frontend/bindings/github.com/AdibAhmed317/shellmoor/internal/services/terminalservice';

export default function Terminal() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      theme: { background: '#1e1e1e' },
      fontFamily: 'Consolas, "Courier New", monospace',
      cursorBlink: true,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);

    setTimeout(() => fitAddon.fit(), 50);

    // 1. Setup the listener FIRST
    const unsubscribe = Events.On('pty:data', (event) => {
      term.write(event.data);
    });

    // 2. Tell Go to start the PTY NOW
    StartTerminal();

    // 3. Wire up typing
    term.onData((data) => {
      WriteInput(data);
    });

    const handleResize = () => {
      fitAddon.fit();
      Resize(term.cols, term.rows);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      unsubscribe();
      term.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', padding: '8px' }}
    />
  );
}
