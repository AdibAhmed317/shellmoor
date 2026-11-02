import { useState } from 'react';

// Real iframe preview. Works for local dev servers; many public sites block iframes.
export default function Browser() {
  const [input, setInput] = useState('http://localhost:5173');
  const [url, setUrl] = useState(input);
  const [reloadKey, setReloadKey] = useState(0);

  const go = () => setUrl(/^https?:\/\//.test(input) ? input : `http://${input}`);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-border px-2 py-1 text-sm">
        <button className="px-2 text-muted hover:text-accent" title="Reload" onClick={() => setReloadKey((k) => k + 1)}>
          ↻
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && go()}
          className="flex-1 rounded border border-border bg-bg px-2 py-1 text-text outline-none focus:border-accent/60"
        />
        <a href={url} target="_blank" rel="noreferrer" className="px-2 text-muted hover:text-accent" title="Open externally">
          ↗
        </a>
      </div>
      <iframe key={reloadKey} src={url} className="min-h-0 flex-1 bg-white" title="Preview" />
    </div>
  );
}
