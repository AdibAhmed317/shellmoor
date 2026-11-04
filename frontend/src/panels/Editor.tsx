import { useEffect, useMemo, useRef, useState } from 'react';
import { AArrowDown, AArrowUp, ChevronDown, ChevronRight, CircleX, Copy, ExternalLink, Eye, File, FileCode, Folder, FolderOpen, Image, Map as MapIcon, PanelLeft, Search, TextWrap, TriangleAlert, X } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { monaco, getModel, languageFor } from '../editor/monaco';
import { mockFiles, mockImages } from '../editor/mockFiles';
import { copyText, openExternal, openPath, revealPath } from '../backend';
import { contextMenu } from '../store/overlays';
import { EmptyState, IconButton, cx } from '../ui';

const isBinaryImage = (path: string) => path in mockImages || /\.(png|jpe?g|gif|webp|ico)$/i.test(path);
const isPreviewable = (path: string) => /\.(md|svg)$/i.test(path);

// Rendered side by side with the source. Markdown is sanitised: file content is untrusted, and this
// webview can call the Go backend. SVG goes through <img>, which never runs embedded scripts.
function Preview({ path, text }: { path: string; text: string }) {
  const html = useMemo(() => (path.endsWith('.md') ? DOMPurify.sanitize(marked.parse(text, { async: false })) : ''), [path, text]);
  if (path.endsWith('.svg')) {
    return (
      <div className="flex h-full items-center justify-center bg-[repeating-conic-gradient(var(--color-surface)_0_25%,var(--color-bg)_0_50%)] bg-[length:16px_16px] p-6">
        <img src={`data:image/svg+xml;utf8,${encodeURIComponent(text)}`} alt={path} className="max-h-full max-w-full" />
      </div>
    );
  }
  return (
    <div
      className="markdown h-full overflow-y-auto px-6 py-5"
      // Links open in the user's browser instead of navigating the app window.
      onClick={(e) => {
        const a = (e.target as HTMLElement).closest('a');
        if (a) (e.preventDefault(), openExternal(a.href));
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function ImageView({ path }: { path: string }) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1 items-center justify-center bg-[repeating-conic-gradient(var(--color-surface)_0_25%,var(--color-bg)_0_50%)] bg-[length:16px_16px] p-6">
        <img src={mockImages[path]} alt={path} onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} className="max-h-full max-w-full rounded shadow-lg" />
      </div>
      <div className="border-t border-border px-3 py-1.5 text-center text-[11px] text-muted">{size ? `${size.w} × ${size.h} px` : 'Loading…'}</div>
    </div>
  );
}

// Quick Open (Ctrl/⌘+P inside the editor): fuzzy file finder, like VS Code.
function QuickOpen({ files, onOpen, onClose }: { files: string[]; onOpen: (path: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const q = query.toLowerCase();
  const matches = files
    .map((f) => {
      const rel = f.slice(ROOT.length + 1).toLowerCase();
      let j = 0;
      for (const ch of rel) if (ch === q[j]) j++;
      return { f, rel, score: j === q.length ? (rel.split('/').pop()!.includes(q) ? 2 : 1) : 0 };
    })
    .filter((m) => !q || m.score)
    .sort((a, b) => b.score - a.score || a.rel.localeCompare(b.rel))
    .slice(0, 12);
  const pick = (f: string) => (onOpen(f), onClose());

  return (
    <div className="absolute inset-0 z-20 flex justify-center bg-black/10 pt-10" onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} className="glass h-fit w-[min(520px,90%)] animate-pop overflow-hidden rounded-xl">
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search size={15} className="text-muted" />
          <input
            autoFocus
            value={query}
            placeholder="Go to file"
            onChange={(e) => (setQuery(e.target.value), setIndex(0))}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') setIndex((i) => Math.min(i + 1, matches.length - 1));
              else if (e.key === 'ArrowUp') setIndex((i) => Math.max(i - 1, 0));
              else if (e.key === 'Enter' && matches[index]) pick(matches[index].f);
              else if (e.key === 'Escape') onClose();
              else return;
              e.preventDefault();
            }}
            className="h-10 flex-1 bg-transparent text-text outline-none placeholder:text-muted/70"
          />
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {matches.map((m, i) => (
            <div
              key={m.f}
              onMouseMove={() => setIndex(i)}
              onClick={() => pick(m.f)}
              className={cx('flex h-8 items-center gap-2 rounded-md px-2.5', i === index ? 'bg-accent text-bg' : 'text-text')}
            >
              {isBinaryImage(m.f) ? <Image size={13} /> : <File size={13} />}
              <span>{m.f.split('/').pop()}</span>
              <span className={cx('truncate text-[11px]', i === index ? 'opacity-70' : 'text-muted')}>{m.rel.split('/').slice(0, -1).join('/')}</span>
            </div>
          ))}
          {matches.length === 0 && <div className="py-4 text-center text-muted">No matching files</div>}
        </div>
      </div>
    </div>
  );
}

type Problem = monaco.editor.IMarker;
type TreeNode = { name: string; path: string; children?: TreeNode[] };

const ROOT = '/my-project';
const savedVersion = new Map<string, number>(); // shared across editor panels, like the models

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode = { name: '', path: ROOT, children: [] };
  for (const path of paths) {
    let node = root;
    const parts = path.slice(ROOT.length + 1).split('/');
    parts.forEach((part, i) => {
      const childPath = `${node.path}/${part}`;
      let child = node.children!.find((c) => c.name === part);
      if (!child) {
        child = { name: part, path: childPath, children: i < parts.length - 1 ? [] : undefined };
        node.children!.push(child);
      }
      node = child;
    });
  }
  const sort = (n: TreeNode[]): TreeNode[] =>
    n
      .sort((a, b) => Number(!a.children) - Number(!b.children) || a.name.localeCompare(b.name))
      .map((c) => (c.children ? { ...c, children: sort(c.children) } : c));
  return sort(root.children!);
}

const allFiles = [...Object.keys(mockFiles), ...Object.keys(mockImages)];
const tree = buildTree(allFiles);
const fileName = (path: string) => path.split('/').pop()!;
const isDirty = (path: string) => monaco.editor.getModel(monaco.Uri.file(path))?.getAlternativeVersionId() !== savedVersion.get(path);

function Tree({ nodes, depth, active, counts, onOpen }: {
  nodes: TreeNode[];
  depth: number;
  active: string;
  counts: Record<string, number>;
  onOpen: (path: string) => void;
}) {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  return (
    <>
      {nodes.map((n) => {
        const open = !closed[n.path];
        return (
          <div key={n.path}>
            <div
              onClick={() => (n.children ? setClosed({ ...closed, [n.path]: open }) : onOpen(n.path))}
              onContextMenu={(e) =>
                contextMenu(e, [
                  ...(n.children ? [] : [{ label: 'Open', icon: FileCode, onSelect: () => onOpen(n.path) }]),
                  { label: 'Open with Default App', icon: ExternalLink, onSelect: () => openPath(n.path) },
                  { label: navigator.userAgent.includes('Mac') ? 'Reveal in Finder' : 'Reveal in File Explorer', icon: FolderOpen, onSelect: () => revealPath(n.path) },
                  'separator',
                  { label: 'Copy Path', icon: Copy, onSelect: () => copyText(n.path) },
                  { label: 'Copy Relative Path', icon: Copy, onSelect: () => copyText(n.path.slice(ROOT.length + 1)) },
                ])
              }
              style={{ paddingLeft: 6 + depth * 14 }}
              className={`mx-1.5 flex h-6 items-center gap-1 rounded-md pr-2 ${n.path === active ? 'bg-accent/15' : 'hover:bg-text/5'}`}
            >
              <span className="w-3.5 text-muted">{n.children && (open ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}</span>
              {n.children ? <Folder size={14} className="shrink-0 text-accent" /> : <File size={14} className="shrink-0 text-muted" />}
              <span className={`min-w-0 flex-1 truncate ${counts[n.path] ? 'text-danger' : ''}`}>{n.name}</span>
              {!!counts[n.path] && <span className="text-[11px] tabular-nums text-danger">{counts[n.path]}</span>}
            </div>
            {n.children && open && <Tree nodes={n.children} depth={depth + 1} active={active} counts={counts} onOpen={onOpen} />}
          </div>
        );
      })}
    </>
  );
}

export default function Editor() {
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const viewStates = useRef(new Map<string, monaco.editor.ICodeEditorViewState | null>());

  const [open, setOpen] = useState<string[]>([`${ROOT}/src/app.ts`]);
  const [active, setActive] = useState(`${ROOT}/src/app.ts`);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [, rerender] = useState(0);
  const [showTree, setShowTree] = useState(true);
  const [showProblems, setShowProblems] = useState(true);
  const [wrap, setWrap] = useState(false);
  const [minimap, setMinimap] = useState(true);
  const [fontSize, setFontSize] = useState(13);
  const [preview, setPreview] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const binary = isBinaryImage(active);

  // Create every model up front so the problems list covers the whole project, not just open files.
  useEffect(() => {
    for (const [path, content] of Object.entries(mockFiles)) {
      const model = getModel(path, content);
      if (!savedVersion.has(path)) savedVersion.set(path, model.getAlternativeVersionId());
    }
    const update = () => setProblems(monaco.editor.getModelMarkers({}).filter((m) => m.resource.path.startsWith(ROOT)));
    update();
    const sub = monaco.editor.onDidChangeMarkers(update);
    return () => sub.dispose();
  }, []);

  useEffect(() => {
    const editor = monaco.editor.create(hostRef.current!, {
      automaticLayout: true,
      fontFamily: '"JetBrains Mono Variable", Consolas, monospace',
      theme: 'shellmoor',
      scrollBeyondLastLine: false,
      renderWhitespace: 'selection',
      bracketPairColorization: { enabled: true },
      padding: { top: 8 },
      smoothScrolling: true,
      cursorSmoothCaretAnimation: 'on',
    });
    editorRef.current = editor;
    const subs = [
      editor.onDidChangeCursorPosition((e) => setCursor({ line: e.position.lineNumber, col: e.position.column })),
      editor.onDidChangeModelContent(() => rerender((n) => n + 1)), // refresh dirty dots
    ];
    // Ctrl+S: no filesystem yet, so "saving" just marks the file clean.
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP, () => setQuickOpen(true));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      const model = editor.getModel();
      if (!model) return;
      savedVersion.set(model.uri.path, model.getAlternativeVersionId());
      rerender((n) => n + 1);
    });
    return () => {
      subs.forEach((s) => s.dispose());
      editor.dispose(); // models are shared, so they are not disposed here
    };
  }, []);

  // Switch model when the active file changes, keeping each file's scroll/cursor.
  useEffect(() => {
    const editor = editorRef.current!;
    if (isBinaryImage(active)) return; // images show in ImageView; no text model
    const current = editor.getModel();
    if (current) viewStates.current.set(current.uri.path, editor.saveViewState());
    editor.setModel(getModel(active, mockFiles[active] ?? ''));
    const vs = viewStates.current.get(active);
    if (vs) editor.restoreViewState(vs);
    editor.focus();
  }, [active]);

  useEffect(() => {
    editorRef.current?.updateOptions({ wordWrap: wrap ? 'on' : 'off', minimap: { enabled: minimap }, fontSize });
  }, [wrap, minimap, fontSize]);

  const openFile = (path: string) => {
    setOpen((o) => (o.includes(path) ? o : [...o, path]));
    setActive(path);
  };

  const closeFile = (path: string) => {
    const rest = open.filter((p) => p !== path);
    setOpen(rest);
    if (path === active && rest.length) setActive(rest[Math.min(open.indexOf(path), rest.length - 1)]);
  };

  const reveal = (p: Problem) => {
    openFile(p.resource.path);
    setTimeout(() => {
      editorRef.current?.revealLineInCenter(p.startLineNumber);
      editorRef.current?.setPosition({ lineNumber: p.startLineNumber, column: p.startColumn });
      editorRef.current?.focus();
    });
  };

  const isError = (p: Problem) => p.severity === monaco.MarkerSeverity.Error;
  const errors = problems.filter(isError).length;
  const warnings = problems.filter((p) => p.severity === monaco.MarkerSeverity.Warning).length;

  // Problem count per file and per containing folder, for the tree.
  const counts: Record<string, number> = {};
  for (const p of problems) {
    if (p.severity < monaco.MarkerSeverity.Warning) continue;
    let path = p.resource.path;
    while (path.length > ROOT.length) {
      counts[path] = (counts[path] ?? 0) + 1;
      path = path.slice(0, path.lastIndexOf('/'));
    }
  }

  return (
    <div className="relative flex h-full">
      {quickOpen && <QuickOpen files={allFiles} onOpen={openFile} onClose={() => (setQuickOpen(false), editorRef.current?.focus())} />}
      {showTree && (
        <div className="flex w-56 shrink-0 flex-col border-r border-border @max-xl:hidden">
          <div className="flex h-9 shrink-0 items-center px-3 text-[11px] font-semibold uppercase tracking-wider text-muted/80">{fileName(ROOT)}</div>
          <div className="min-h-0 flex-1 overflow-y-auto pb-2">
            <Tree nodes={tree} depth={0} active={active} counts={counts} onOpen={openFile} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border pl-1.5 pr-1.5">
          <IconButton icon={PanelLeft} label="Explorer" active={showTree} onClick={() => setShowTree(!showTree)} />
          <div className="flex h-full min-w-0 flex-1 items-end gap-0.5 overflow-x-auto">
            {open.map((path) => {
              const dirty = isDirty(path);
              const current = path === active;
              return (
                <div
                  key={path}
                  onClick={() => setActive(path)}
                  onAuxClick={(e) => e.button === 1 && closeFile(path)}
                  title={path}
                  className={`group relative flex h-8 shrink-0 items-center gap-1.5 rounded-t-md pl-2.5 pr-1 ${
                    current ? 'bg-text/6 text-text' : 'text-muted hover:text-text'
                  }`}
                >
                  {current && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />}
                  <span className={counts[path] ? 'text-danger' : ''}>{fileName(path)}</span>
                  <button
                    onClick={(e) => (e.stopPropagation(), closeFile(path))}
                    aria-label="Close"
                    className="flex h-5 w-5 items-center justify-center rounded hover:bg-text/10"
                  >
                    {dirty ? (
                      <>
                        <span className="h-2 w-2 rounded-full bg-text/70 group-hover:hidden" />
                        <X size={12} className="hidden group-hover:block" />
                      </>
                    ) : (
                      <X size={12} className={current ? 'opacity-60' : 'opacity-0 group-hover:opacity-60'} />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
          {isPreviewable(active) && <IconButton icon={Eye} label="Preview" active={preview} onClick={() => setPreview(!preview)} />}
          <IconButton icon={Search} label={`Go to file (${navigator.userAgent.includes('Mac') ? '⌘P' : 'Ctrl+P'})`} onClick={() => setQuickOpen(true)} />
          <IconButton icon={TextWrap} label="Word wrap" active={wrap} onClick={() => setWrap(!wrap)} />
          <IconButton icon={MapIcon} label="Minimap" active={minimap} onClick={() => setMinimap(!minimap)} />
          <IconButton icon={AArrowDown} label="Smaller text" onClick={() => setFontSize((s) => Math.max(9, s - 1))} />
          <IconButton icon={AArrowUp} label="Larger text" onClick={() => setFontSize((s) => Math.min(28, s + 1))} />
        </div>

        {/* Kept mounted even with no files open, so the editor instance survives. */}
        <div className={cx('min-h-0 flex-1', open.length ? 'flex' : 'hidden')}>
          <div ref={hostRef} className={cx('min-w-0 flex-1', binary && 'hidden')} />
          {binary && <div className="min-w-0 flex-1"><ImageView path={active} /></div>}
          {!binary && preview && isPreviewable(active) && (
            <div className="min-w-0 flex-1 border-l border-border">
              <Preview path={active} text={monaco.editor.getModel(monaco.Uri.file(active))?.getValue() ?? ''} />
            </div>
          )}
        </div>
        {!open.length && (
          <div className="flex-1">
            <EmptyState icon={FileCode} title="No file open" body="Pick a file in the explorer." />
          </div>
        )}

        {showProblems && (
          <div className="flex h-40 shrink-0 flex-col border-t border-border">
            <div className="flex h-8 shrink-0 items-center gap-2 px-3 text-xs">
              <span className="font-medium">Problems</span>
              <span className="rounded-full bg-text/8 px-1.5 text-[11px] tabular-nums text-muted">{problems.length}</span>
              <span className="flex-1" />
              <IconButton icon={X} size={13} label="Hide problems" className="!h-6 !w-6" onClick={() => setShowProblems(false)} />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pb-1">
              {problems.length === 0 && <div className="px-3 py-2 text-muted">No problems detected.</div>}
              {problems.map((p, i) => (
                <div key={i} onClick={() => reveal(p)} className="mx-1.5 flex h-6 items-center gap-2 rounded-md px-2 hover:bg-text/5">
                  {isError(p) ? <CircleX size={13} className="shrink-0 text-danger" /> : <TriangleAlert size={13} className="shrink-0 text-warning" />}
                  <span className="min-w-0 flex-1 truncate">{p.message}</span>
                  <span className="shrink-0 text-[11px] text-muted">
                    {fileName(p.resource.path)} · {p.startLineNumber}:{p.startColumn}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex h-6 shrink-0 items-center gap-4 border-t border-border px-3 text-[11px] text-muted">
          <button onClick={() => setShowProblems(!showProblems)} className="flex items-center gap-2.5 hover:text-text">
            <span className={`flex items-center gap-1 ${errors ? 'text-danger' : ''}`}><CircleX size={11} />{errors}</span>
            <span className={`flex items-center gap-1 ${warnings ? 'text-warning' : ''}`}><TriangleAlert size={11} />{warnings}</span>
          </button>
          {open.length > 0 && isDirty(active) && <span>Edited · {navigator.userAgent.includes('Mac') ? '⌘S' : 'Ctrl+S'} to save</span>}
          <span className="flex-1" />
          <span className="tabular-nums">Ln {cursor.line}, Col {cursor.col}</span>
          <span>Spaces: 2</span>
          <span>UTF-8</span>
          <span className="capitalize">{open.length ? (binary ? 'Image' : languageFor(active)) : ''}</span>
        </div>
      </div>
    </div>
  );
}
