import * as monaco from 'monaco-editor';
// monaco-editor's exports map "./*" to "./esm/vs/*.js".
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/language/json/json.worker?worker';
import CssWorker from 'monaco-editor/language/css/css.worker?worker';
import HtmlWorker from 'monaco-editor/language/html/html.worker?worker';
import TsWorker from 'monaco-editor/language/typescript/ts.worker?worker';
import { useTheme, activeTheme } from '../store/theme';
import type { Theme } from '../themes';

// Bundled locally so the editor works offline (no CDN loader).
self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'json') return new JsonWorker();
    if (label === 'css' || label === 'scss' || label === 'less') return new CssWorker();
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new HtmlWorker();
    if (label === 'typescript' || label === 'javascript') return new TsWorker();
    return new EditorWorker();
  },
};

// Monaco themes are global, so one definition follows the app theme for every editor.
function defineAppTheme(t: Theme) {
  monaco.editor.defineTheme('shellmoor', {
    base: t.type === 'dark' ? 'vs-dark' : 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: t.muted.slice(1), fontStyle: 'italic' },
      { token: 'keyword', foreground: t.ansi[5].slice(1) },
      { token: 'string', foreground: t.ansi[2].slice(1) },
      { token: 'number', foreground: t.ansi[3].slice(1) },
      { token: 'type', foreground: t.ansi[6].slice(1) },
    ],
    colors: {
      'editor.background': t.bg,
      'editor.foreground': t.text,
      'editorLineNumber.foreground': t.muted,
      'editorLineNumber.activeForeground': t.text,
      'editorCursor.foreground': t.accent,
      'editor.selectionBackground': t.accent + '40',
      'editor.lineHighlightBackground': t.surface,
      'editorIndentGuide.background1': t.border,
      'editorWidget.background': t.surface,
      'editorWidget.border': t.border,
      'minimap.background': t.bg,
    },
  });
  monaco.editor.setTheme('shellmoor');
}

defineAppTheme(activeTheme(useTheme.getState()));
useTheme.subscribe((s) => defineAppTheme(activeTheme(s)));

const languageByExt: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', json: 'json',
  css: 'css', scss: 'scss', html: 'html', md: 'markdown', go: 'go', py: 'python', rs: 'rust',
  yml: 'yaml', yaml: 'yaml', sh: 'shell', ps1: 'powershell', sql: 'sql', toml: 'ini', env: 'ini',
  dockerfile: 'dockerfile', xml: 'xml', java: 'java', c: 'c', cpp: 'cpp', cs: 'csharp', php: 'php', rb: 'ruby',
};

export function languageFor(path: string) {
  const name = path.split('/').pop()!.toLowerCase();
  if (name === 'dockerfile') return 'dockerfile';
  return languageByExt[name.split('.').pop()!] ?? 'plaintext';
}

// Models are shared by URI, so two editor panels on the same file stay in sync (like VS Code).
export function getModel(path: string, content: string) {
  const uri = monaco.Uri.file(path);
  return monaco.editor.getModel(uri) ?? monaco.editor.createModel(content, languageFor(path), uri);
}

export { monaco };
