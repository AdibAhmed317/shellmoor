import { useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChevronDown, ExternalLink, Globe, RotateCw, Star, X } from 'lucide-react';
import { openExternal } from '../backend';
import { IconButton, Segmented, Toolbar, cx, wideOnly } from '../ui';

type Device = 'responsive' | 'tablet' | 'mobile';
const widths: Record<Device, string> = { responsive: '100%', tablet: '820px', mobile: '390px' };

// Saved preview URLs (the spec's "configure local preview URLs").
const useSaved = create<{ urls: string[] }>()(
  persist(() => ({ urls: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:8080'] }), { name: 'shellmoor-previews' }),
);

const normalise = (input: string) => (/^https?:\/\//.test(input) ? input : `http://${input}`);
const display = (url: string) => url.replace(/^https?:\/\//, '');

// Real iframe preview. Works for local dev servers; many public sites refuse to be framed.
export default function Browser() {
  const saved = useSaved((s) => s.urls);
  const [url, setUrl] = useState(saved[0] ?? 'http://localhost:5173');
  const [input, setInput] = useState(display(url));
  const [reloadKey, setReloadKey] = useState(0);
  const [device, setDevice] = useState<Device>('responsive');
  const [menu, setMenu] = useState(false);
  const isSaved = saved.includes(url);

  const go = (target: string) => {
    const next = normalise(target.trim());
    setUrl(next);
    setInput(display(next));
    setMenu(false);
  };
  const toggleSaved = () => useSaved.setState({ urls: isSaved ? saved.filter((u) => u !== url) : [...saved, url] });

  return (
    <div className="flex h-full flex-col">
      <Toolbar className="!overflow-visible">
        <IconButton icon={RotateCw} label="Reload" onClick={() => setReloadKey((k) => k + 1)} />
        <div className="relative flex min-w-0 flex-1">
          <div className="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-md bg-text/6 pl-2.5 pr-1 focus-within:ring-2 focus-within:ring-accent/30">
            <Globe size={13} className="shrink-0 text-muted" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && go(input)}
              onFocus={(e) => e.target.select()}
              className="min-w-0 flex-1 bg-transparent text-text outline-none"
            />
            <button title={isSaved ? 'Remove from saved' : 'Save this URL'} onClick={toggleSaved} className="p-0.5 text-muted hover:text-accent">
              <Star size={13} className={cx(isSaved && 'fill-accent text-accent')} />
            </button>
            <button title="Saved URLs" onClick={() => setMenu(!menu)} className="p-0.5 text-muted hover:text-text">
              <ChevronDown size={13} />
            </button>
          </div>
          {menu && (
            <>
              <div className="fixed inset-0 z-30" onMouseDown={() => setMenu(false)} />
              <div className="glass absolute left-0 right-0 top-full z-40 mt-1.5 animate-pop rounded-xl p-1.5">
                <div className="px-2.5 pb-1 text-[11px] font-semibold text-muted">Saved previews</div>
                {saved.length === 0 && <div className="px-2.5 py-1.5 text-muted">Star a URL to keep it here.</div>}
                {saved.map((u) => (
                  <div key={u} onClick={() => go(u)} className="group flex h-7 items-center gap-2 rounded-md px-2.5 hover:bg-accent hover:text-bg">
                    <Globe size={13} />
                    <span className="flex-1 truncate">{display(u)}</span>
                    <button
                      title="Remove"
                      onClick={(e) => (e.stopPropagation(), useSaved.setState({ urls: saved.filter((x) => x !== u) }))}
                      className="opacity-0 group-hover:opacity-80"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className={wideOnly}>
          <Segmented
            value={device}
            onChange={setDevice}
            options={[{ value: 'responsive', label: 'Fill' }, { value: 'tablet', label: 'Tablet' }, { value: 'mobile', label: 'Phone' }]}
          />
        </div>
        <IconButton icon={ExternalLink} label="Open in default browser" onClick={() => openExternal(url)} />
      </Toolbar>
      <div className="flex min-h-0 flex-1 justify-center bg-text/4">
        <iframe
          key={reloadKey}
          src={url}
          title="Preview"
          style={{ width: widths[device] }}
          className={`h-full max-w-full bg-white ${device === 'responsive' ? '' : 'my-3 rounded-lg shadow-lg'}`}
        />
      </div>
    </div>
  );
}
