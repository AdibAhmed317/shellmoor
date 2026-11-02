import { useState } from 'react';

type Entry = { name: string; children?: Entry[] };

// Dummy data until the Go side exposes the filesystem.
const tree: Entry[] = [
  {
    name: 'src',
    children: [
      { name: 'components', children: [{ name: 'Header.tsx' }, { name: 'Sidebar.tsx' }] },
      { name: 'App.tsx' },
      { name: 'main.tsx' },
    ],
  },
  { name: 'public', children: [{ name: 'logo.png' }] },
  { name: 'README.md' },
  { name: 'package.json' },
  { name: 'tsconfig.json' },
];

const preview: Record<string, string> = {
  'README.md': '# my-project\n\nA sample project.\n\n## Getting started\n\n    npm install\n    npm run dev',
  'package.json': '{\n  "name": "my-project",\n  "version": "1.0.0",\n  "scripts": { "dev": "vite" }\n}',
};

function Node({ entry, depth, selected, onSelect }: { entry: Entry; depth: number; selected: string; onSelect: (n: string) => void }) {
  const [open, setOpen] = useState(depth === 0);
  const isDir = !!entry.children;
  return (
    <>
      <div
        onClick={() => (isDir ? setOpen(!open) : onSelect(entry.name))}
        style={{ paddingLeft: 8 + depth * 14 }}
        className={`cursor-pointer py-0.5 pr-2 hover:bg-bg ${selected === entry.name ? 'text-accent' : 'text-text'}`}
      >
        <span className="inline-block w-4 text-muted">{isDir ? (open ? '▾' : '▸') : ''}</span>
        {entry.name}
      </div>
      {isDir && open && entry.children!.map((c) => <Node key={c.name} entry={c} depth={depth + 1} selected={selected} onSelect={onSelect} />)}
    </>
  );
}

export default function Files() {
  const [selected, setSelected] = useState('README.md');
  const [query, setQuery] = useState('');

  return (
    <div className="flex h-full text-sm">
      <div className="flex w-56 shrink-0 flex-col border-r border-border">
        <input
          placeholder="Search files…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="m-2 rounded border border-border bg-bg px-2 py-1 text-text outline-none focus:border-accent/60"
        />
        <div className="text-xs uppercase tracking-wide text-muted px-3 pb-1">~/projects/my-project</div>
        <div className="min-h-0 flex-1 overflow-auto">
          {tree
            .filter((e) => e.name.toLowerCase().includes(query.toLowerCase()) || e.children)
            .map((e) => (
              <Node key={e.name} entry={e} depth={0} selected={selected} onSelect={setSelected} />
            ))}
        </div>
      </div>
      <div className="min-w-0 flex-1 overflow-auto">
        <div className="border-b border-border px-3 py-1 text-xs text-muted">{selected}</div>
        <pre className="p-3 font-mono text-xs text-text whitespace-pre-wrap">
          {preview[selected] ?? `// preview of ${selected}`}
        </pre>
      </div>
    </div>
  );
}
