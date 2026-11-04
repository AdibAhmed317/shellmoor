// Extensions: panels supplied as HTML, run in a sandboxed iframe (no same-origin, so no access to
// the app, its storage or the Go bindings). They talk to Shellmoor only through postMessage:
//   extension → app: { type: 'toast', message: string }
//   app → extension: { type: 'theme', colors: { bg, surface, text, muted, accent, border } } on load and on theme change
// Also holds which built-in tools are switched off.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PanelKind } from './workspace';

export type Extension = {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  enabled: boolean;
  html: string; // entry page, rendered via iframe srcdoc
};

// Shipped as a working example of the extension API.
const demo: Extension = {
  id: 'hello-extension',
  name: 'Port Notes',
  description: 'Demo extension: a scratchpad for which local ports run what. Shows the theme and toast APIs.',
  version: '1.0.0',
  author: 'Shellmoor',
  enabled: true,
  html: `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;padding:20px;font:13px system-ui,sans-serif;background:var(--bg);color:var(--text)}
  h1{font-size:17px;margin:0 0 4px} p{color:var(--muted);margin:0 0 16px}
  .row{display:flex;gap:8px;margin-bottom:8px} input{flex:1;background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:6px 10px}
  button{background:var(--accent);color:var(--bg);border:0;border-radius:999px;padding:6px 14px;font-weight:600;cursor:pointer}
  li{padding:6px 0;border-bottom:1px solid var(--border);list-style:none} ul{padding:0;margin:0} code{color:var(--accent)}
</style></head><body>
  <h1>Port Notes</h1><p>An example extension running in a sandbox.</p>
  <div class="row"><input id="port" placeholder="5173" size="6"><input id="what" placeholder="Vite dev server"><button id="add">Add</button></div>
  <ul id="list"><li><code>5432</code> Postgres (docker)</li><li><code>6379</code> Redis</li></ul>
<script>
  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'theme') for (var k in e.data.colors) document.documentElement.style.setProperty('--' + k, e.data.colors[k]);
  });
  document.getElementById('add').onclick = function () {
    var port = document.getElementById('port').value, what = document.getElementById('what').value;
    if (!port) return;
    var li = document.createElement('li'); li.innerHTML = '<code></code> '; li.firstChild.textContent = port; li.appendChild(document.createTextNode(what));
    document.getElementById('list').appendChild(li);
    parent.postMessage({ type: 'toast', message: 'Noted port ' + port }, '*');
  };
</script></body></html>`,
};

type ExtensionsState = {
  extensions: Extension[];
  disabledTools: PanelKind[];
  setEnabled: (id: string, enabled: boolean) => void;
  remove: (id: string) => void;
  install: (ext: Extension) => void;
  setToolEnabled: (kind: PanelKind, enabled: boolean) => void;
};

export const useExtensions = create<ExtensionsState>()(
  persist(
    (set) => ({
      extensions: [demo],
      disabledTools: [],
      setEnabled: (id, enabled) => set((s) => ({ extensions: s.extensions.map((e) => (e.id === id ? { ...e, enabled } : e)) })),
      remove: (id) => set((s) => ({ extensions: s.extensions.filter((e) => e.id !== id) })),
      install: (ext) => set((s) => ({ extensions: [...s.extensions.filter((e) => e.id !== ext.id), ext] })),
      setToolEnabled: (kind, enabled) =>
        set((s) => ({ disabledTools: enabled ? s.disabledTools.filter((k) => k !== kind) : [...new Set([...s.disabledTools, kind])] })),
    }),
    { name: 'shellmoor-extensions' },
  ),
);

export const extensionById = (id?: string) => useExtensions.getState().extensions.find((e) => e.id === id);
