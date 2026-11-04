// The single seam between the UI and anything only the desktop/backend can do.
// Functions that use the Wails runtime work today in the desktop app and fall back gracefully
// in a plain browser preview. Functions marked TODO(backend) need a Go service.
import { Browser, Clipboard, Dialogs, Events, Window } from '@wailsio/runtime';
import { toast } from './store/overlays';

// Set to true together with `Frameless: true` in main.go (WebviewWindowOptions) to draw our own
// window controls and make the toolbar draggable. On macOS prefer the hidden-inset title bar instead.
export const FRAMELESS = false;

export async function pickFolder(title = 'Choose Folder'): Promise<string | null> {
  try {
    const result = await Dialogs.OpenFile({ CanChooseDirectories: true, CanChooseFiles: false, CanCreateDirectories: true, Title: title });
    return (Array.isArray(result) ? result[0] : result) || null;
  } catch {
    return null; // browser preview: no native dialog
  }
}

export async function pickFile(title = 'Choose File'): Promise<string | null> {
  try {
    const result = await Dialogs.OpenFile({ CanChooseFiles: true, ShowHiddenFiles: true, Title: title });
    return (Array.isArray(result) ? result[0] : result) || null;
  } catch {
    return null;
  }
}

export async function openExternal(url: string) {
  try {
    await Browser.OpenURL(url);
  } catch {
    window.open(url, '_blank', 'noopener');
  }
}

// TODO(backend): open with the OS default app / reveal in Explorer, Finder or the Linux file manager.
// Both must check the path against Settings › Privacy & Security › allowed folders first.
export async function openPath(path: string) {
  toast('Open with default app needs the backend', { description: path });
}
export async function revealPath(path: string) {
  toast('Reveal in file manager needs the backend', { description: path });
}

export async function copyText(text: string) {
  try {
    await Clipboard.SetText(text);
  } catch {
    await navigator.clipboard?.writeText(text);
  }
}

export async function readText(): Promise<string> {
  try {
    return await Clipboard.Text();
  } catch {
    return (await navigator.clipboard?.readText()) ?? '';
  }
}

export const windowControls = {
  minimise: () => Window.Minimise().catch(() => {}),
  toggleMaximise: () => Window.ToggleMaximise().catch(() => {}),
  close: () => Window.Close().catch(() => window.close()),
};

// TODO(backend): create a second WebviewWindow (Go: app.Window.NewWithOptions) and hand it the
// serialised tabs to show. Returns false until then, so callers keep the tab where it is.
export async function openNewWindow(snapshotJson?: string): Promise<boolean> {
  void snapshotJson;
  toast('New windows need the backend', { description: 'Go must create the window; see BACKEND.md.' });
  return false;
}

// Quit handshake. Go emits `shellmoor:quit-requested` when the window is closing; the UI decides
// (e.g. confirm if terminals are running) and answers with `shellmoor:quit-response` {quit: boolean}.
export function onQuitRequested(decide: () => Promise<boolean>) {
  return Events.On('shellmoor:quit-requested', async () => {
    const quit = await decide();
    Events.Emit('shellmoor:quit-response', { quit }).catch(() => {});
  });
}

// TODO(backend): read <folder>/manifest.json (and its entry HTML) after an allowed-paths check,
// return it for the extensions store. Returns null until then.
export async function readExtensionFolder(folder: string): Promise<{ manifest: unknown; html: string } | null> {
  toast('Installing extensions needs the backend', { description: `Would read ${folder}/manifest.json` });
  return null;
}

// Desktop notification. Uses the web Notification API, which WebView2/WKWebView support.
// TODO(backend): switch to a native notification service if the webview one is unreliable.
export async function notify(title: string, body: string) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') await Notification.requestPermission();
  if (Notification.permission === 'granted') new Notification(title, { body });
}

// Saves a text file via the webview's download flow.
// TODO(backend): use Dialogs.SaveFile + a Go write if the webview blocks downloads.
export function downloadFile(name: string, text: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// TODO(backend): store in the OS keychain (Keychain / Credential Manager / Secret Service).
// Kept in memory only until then, so secrets never reach localStorage.
const memorySecrets = new Map<string, string>();
export async function saveSecret(name: string, value: string) {
  memorySecrets.set(name, value);
}
export async function deleteSecret(name: string) {
  memorySecrets.delete(name);
}
