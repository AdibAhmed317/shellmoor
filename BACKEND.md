# Backend contract

The UI is complete and runs on mock data. This file lists every place the frontend expects the Go side to take over, and what each one needs. Find all of them in code with:

```
grep -rn "TODO(backend)" frontend/src
```

## How the UI talks to Go

- **Calls:** methods on services registered in `main.go` become generated bindings in `frontend/bindings/` (run `wails3 generate bindings`, or `task dev` does it). Import them in the panel that needs them, as `components/Terminal.tsx` does today.
- **Streams:** use Wails events (`application.Get().Event.Emit(name, data)` in Go, `Events.On(name, cb)` in the UI) for anything continuous: terminal output, logs, metrics, transfer progress, AI tokens.
- **Desktop-only helpers** live in one file, `frontend/src/backend.ts`. Some already work through the Wails runtime (folder/file pickers, clipboard, opening URLs, window controls). The rest are stubs to replace.
- **Settings** persist in `localStorage` under `shellmoor-*` keys and need no backend. Secrets are the exception (see below).

## Feature by feature

| Feature | Mock lives in | What the backend provides |
|---|---|---|
| **Terminal sessions** | `components/Terminal.tsx` (one shared PTY) | One PTY per pane: `Start(paneId, profile)`, `Write(paneId, data)`, `Resize(paneId, cols, rows)`, `Close(paneId)`. Emit `pty:data` with `{paneId, data}` and a `pty:exit` with `{paneId, code}`. The profile carries `shell`, `args`, `cwd`, `env` (KEY=value lines). Use the current project's `path` as `cwd` when set. Kill processes when a pane unmounts. |
| **Command history** | `store/history.ts` | Shell integration (OSC 133 or preexec hooks) so each entry has command, cwd, exit code, duration and host. |
| **Session logs** | Settings › Terminal | When `logging` is on, write each session to `logFolder` and delete files older than `logRetentionDays`. |
| **Finish notifications** | `panels/Tasks.tsx` uses them already | Terminals need the same: with shell integration, notify when a command ran longer than `notifyAfterSeconds`. |
| **Files and editor** | `editor/mockFiles.ts` | `List(dir)`, `Read(path)`, `Write(path, content)`, optionally a watcher. Plus `openPath` and `revealPath` in `backend.ts`. **Every file call must check `allowedPaths` from Settings › Privacy & Security in Go. Never trust the UI for this.** |
| **Git** | `panels/Git.tsx` | Status (staged/unstaged with M/A/D), `Diff(file, staged)` as unified text, `Stage`, `Unstage`, `Discard`, `Commit(message)`, `Pull`, `Push`, ahead/behind counts, `Branches` (local + remote), `Checkout`, `CreateBranch`, `Log`. The UI already renders unified and split views from unified diff text. |
| **SSH hosts** | `store/hosts.ts` | Keep the store as the source of saved hosts; optionally import `~/.ssh/config`. Remove the simulated fields (`online`, `os`, `cores`, `procs`…) once real data flows. |
| **SSH sessions and SFTP** | `panels/Ssh.tsx` | `Connect(hostId)` honouring auth method, key path, jump host, keep-alive and auto-reconnect. Emit `ssh:state` with `{hostId, state}` (`connecting`, `connected`, `reconnecting`, `failed`, `idle`). The UI already renders all of these, including the reconnecting banner. Remote shells reuse the terminal session API. SFTP: `List`, `Upload`, `Download` with progress events. Port forwards come from the host's `forwards` list. |
| **Activity** | `panels/Monitor.tsx` | Local stats (e.g. gopsutil): CPU %, memory, network, disk, process list. Remote stats over SSH (`/proc`) or a small agent. `KillProcess(hostId, pid)`. `showHostActivity(hostId)` already deep-links from Remote Hosts. |
| **Docker** | `panels/Docker.tsx` | Docker Engine API: containers with stats, images, start/stop/restart/remove, pull, streamed logs. "Open Shell" already opens a terminal typed with `docker exec -it <name> sh`. |
| **Kubernetes** | `panels/Kubernetes.tsx` | kubeconfig contexts, namespaces, pod list (watch), describe, streamed logs, delete, port-forward. "Exec" already opens a terminal typed with the `kubectl exec` command. |
| **Tasks** | `panels/Tasks.tsx` | Detect tasks from `package.json` scripts, `Makefile`, `Taskfile.yml`; run each in a PTY; stream output; report exit code. The UI handles toasts and notifications. |
| **AI assistant** | `panels/Assistant.tsx` | Call the configured provider from Go (never from the webview, so the key never reaches JS). Stream tokens as events. Include only the context the user enabled (`aiShareTerminal`, `aiShareFiles`). The UI always asks before running a suggested command. |

## `backend.ts` stubs

| Function | Today | Replace with |
|---|---|---|
| `saveSecret` / `deleteSecret` | In-memory only | OS keychain (Keychain, Credential Manager, Secret Service). Used for SSH passwords (`ssh:<hostId>`) and AI keys (`ai:<provider>`). |
| `openPath` / `revealPath` | Toast saying it needs the backend | Open with default app / reveal in file manager, after the allowed-paths check. |
| `notify` | Web Notification API | Fine if it works in your webview; otherwise a native notification. |
| `downloadFile` | Webview download | `Dialogs.SaveFile` plus a Go write if the webview blocks downloads. |
| `FRAMELESS` | `false` | Set to `true` together with `Frameless: true` in `main.go`. The toolbar then becomes the drag area and our own minimise/maximise/close buttons appear on Windows and Linux. On macOS, use the hidden-inset title bar instead so the traffic lights stay native. |

## Window lifecycle

- **Confirm before quitting:** the UI side is done. When the window is about to close, emit `shellmoor:quit-requested` (no data). The UI answers with `shellmoor:quit-response` carrying `{ quit: boolean }`: it asks the user if terminals are open and Settings › General › "Confirm before quitting" is on. Close only if `quit` is true.
- **New windows:** `openNewWindow(snapshotJson?)` in `backend.ts` returns `false` today. Implement it by creating a second `WebviewWindow` in Go and handing it the snapshot (`{ tabs, activeTabId }` JSON) to load. "Move Tab to New Window" closes the tab only when this returns `true`.

## Extensions

The UI hosts extensions as sandboxed iframes (`sandbox="allow-scripts"`, no same-origin), so they cannot reach the app, its storage or the Go bindings. The message API lives in `frontend/src/store/extensions.ts`: today the app sends theme colours, and the extension may request toasts.

To make "Install from Folder…" work, implement `readExtensionFolder(folder)` in `backend.ts`. After the allowed-paths check, read `manifest.json` (`id`, `name`, `description`, `version`, `author`, `entry`) and the entry HTML, then call `useExtensions.getState().install({ ...manifest, enabled: true, html })`. If extensions ever need more power (run commands, read files), add it as new message types that the host checks and asks the user about. Never relax the sandbox.

## Security rules the UI assumes

- No TCP listener. Everything goes through Wails in-process.
- Allowed-paths checks happen in Go for every file operation.
- Secrets live only in the OS keychain; settings export never includes them.
- Markdown from files is sanitised in the UI (DOMPurify). Keep it that way if you add more HTML rendering.
