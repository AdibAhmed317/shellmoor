import { useEffect, useRef } from 'react';
import { Puzzle } from 'lucide-react';
import { useExtensions } from '../store/extensions';
import { useTheme, activeTheme } from '../store/theme';
import { openSettings } from '../store/ui';
import { toast } from '../store/overlays';
import { Button, EmptyState } from '../ui';
import type { PanelProps } from './registry';

// Hosts one extension in a sandboxed iframe. `allow-scripts` without `allow-same-origin` gives it an
// opaque origin: no access to Shellmoor's DOM, localStorage or Go bindings. See store/extensions.ts for the API.
export default function Extension({ extensionId }: PanelProps) {
  const ext = useExtensions((s) => s.extensions.find((e) => e.id === extensionId));
  const frameRef = useRef<HTMLIFrameElement>(null);

  // Theme: sent on load and whenever it changes.
  useEffect(() => {
    const send = () => {
      const t = activeTheme(useTheme.getState());
      const border = getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim();
      frameRef.current?.contentWindow?.postMessage({ type: 'theme', colors: { bg: t.bg, surface: t.surface, text: t.text, muted: t.muted, accent: t.accent, border } }, '*');
    };
    const frame = frameRef.current;
    frame?.addEventListener('load', send);
    const unsub = useTheme.subscribe(send);
    return () => {
      frame?.removeEventListener('load', send);
      unsub();
    };
  }, [ext?.html]);

  // Messages from this extension only (checked by source), and only the documented types.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frameRef.current?.contentWindow || !ext) return;
      if (e.data?.type === 'toast' && typeof e.data.message === 'string') toast(e.data.message.slice(0, 200), { description: ext.name });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [ext]);

  if (!ext) return <EmptyState icon={Puzzle} title="Extension not installed" body="It may have been removed in Settings › Extensions." />;
  if (!ext.enabled) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <EmptyState icon={Puzzle} title={`${ext.name} is turned off`} body="Turn it on in Settings › Extensions." />
        <Button onClick={() => openSettings('extensions')}>Open Extensions</Button>
      </div>
    );
  }
  return <iframe ref={frameRef} title={ext.name} sandbox="allow-scripts" srcDoc={ext.html} className="h-full w-full border-0 bg-bg" />;
}
