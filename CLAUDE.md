# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Shellmoor is a terminal emulator built with Wails v3 (Go backend + React/TypeScript/Vite frontend using xterm.js). The README is the unmodified Wails template and is partly inaccurate (there is no `app.go` or `wails.json`).

## Product spec

The full spec and roadmap are in [contex/ultimate_terminal_project_feature_list (1).pdf](contex/) ("Ultimate Terminal"). It describes a lightweight, cross-platform developer workspace: a minimal terminal UI with flexible panels and a persistent Go backend.

**Vision (from the owner):** the *one app* a technical person needs open: developers, AI engineers, DevOps and cloud people. The terminal, SSH, SFTP, a browser preview, files, Git and workspaces all live as panels in a single window, so nobody juggles a dozen separate tools. Every feature is a panel type in a shared workspace and panel system, so build that system as the backbone and not as an afterthought.

- **First-release goal:** a beautiful, fast terminal with reliable sessions and flexible split workspaces on Windows, macOS, and Linux. Everything else builds on that.
- **Roadmap:** P0 usable terminal (tabs, split panes, independent sessions, ANSI/Unicode, copy/paste, resize, Claude Code/TUI compatibility, shortcuts, command palette, process cleanup) → P1 workspace (resizable panel tree, draggable tabs, saved layouts, project switcher, file explorer, preferences) → P2 dev tools (Git, previews, embedded browser, history, task runner) → P3 SSH/SFTP → P4 optional AI panel and plugins.
- **UI direction:** dark theme with a restrained mint accent, compact title bar and status bar, keyboard-first, context sidebar hidden by default.
- **Constraints:** the core app must work without any AI key; no unauthenticated TCP listener; restrict filesystem access to explicitly permitted paths; restoring a layout must not revive stale processes; users must not need Go installed.
- **Out of scope for v1:** a full IDE/editor, a custom terminal renderer, cloud sync, a plugin marketplace, and multi-user collaboration.
- **Stack divergence:** the spec lists Tauri 2 + Rust host + Go sidecar over named pipes/Unix sockets, with Tailwind, Zustand, and SQLite. The actual code uses **Wails v3** (Go is the host; the frontend calls it through Wails bindings and events), and SQLite is not set up yet (Tailwind v4 and Zustand are in use). Follow the code, not the spec's stack table, unless told otherwise.

## Commands

Tasks are defined in `Taskfile.yml` (Taskfile v3) and dispatch to per-OS Taskfiles in `build/<os>/` via `GOOS`.

- `task dev` (or `wails3 dev -config ./build/config.yml -port 9245`) — dev mode with hot reload
- `task build` / `task package` / `task run` — build, package, run for the host OS
- `task build:server` / `task run:server` — headless HTTP server mode
- Frontend only (from `frontend/`): `npm run build` (runs `tsc` then `vite build`), `npm run dev`
- No test or lint setup exists.

## Architecture

- [main.go](main.go) creates the Wails app, registers `services.TerminalService`, and embeds `frontend/dist` via `//go:embed all:frontend/dist` — **`frontend/dist` must exist (run a frontend build) or `go build` fails**. It is gitignored.
- [internal/services/terminal.go](internal/services/terminal.go) owns a single PTY (`go-pty`), spawns the shell (PowerShell `-NoLogo -NoProfile` on Windows, `$SHELL` elsewhere, with fallbacks), and streams output to the frontend via the Wails event `pty:data`. Only one PTY per service instance (`StartTerminal` is a no-op if already started).
- **The UI is feature-complete on mock data; the Go side is being built by the owner.** [BACKEND.md](BACKEND.md) is the contract: what each panel expects from Go. Every mock is marked `TODO(backend)` (`grep -rn "TODO(backend)" frontend/src`). Anything only the desktop/backend can do goes through [src/backend.ts](frontend/src/backend.ts) (pickers, clipboard, keychain, notifications, window controls, `FRAMELESS` flag).
- Frontend shell ([pages/Workspace.tsx](frontend/src/pages/Workspace.tsx)): TitleBar (tabs, palette field, settings) / optional Sidebar (project switcher, profiles, tools, Layouts/History/Settings) / panes / StatusBar.
  - Sheets (palette, settings, projects, new project, layouts, history, host editor) are one-at-a-time via `useUi().open({ type })` in [store/ui.ts](frontend/src/store/ui.ts); non-settings ones render in [components/Sheets.tsx](frontend/src/components/Sheets.tsx).
  - Transient UI uses the promise helpers in [store/overlays.ts](frontend/src/store/overlays.ts): `contextMenu(e, items)`, `await confirm({ destructive })`, `await prompt()`, `toast()`. Destructive confirms focus Cancel. Use these rather than `window.confirm` or ad-hoc popovers.
- Other stores (all Zustand, persisted to `shellmoor-*` localStorage keys unless noted): `projects` (name, folder, saved tab snapshot per project), `layouts` (built-in templates + saved layouts), `settings` (preferences + `keymap` shortcut overrides; **never secrets**), `hosts` (saved SSH hosts), `history` (not persisted).
- Workspace: [src/store/workspace.ts](frontend/src/store/workspace.ts) (Zustand, persisted) holds tabs. Restoring a snapshot (`load`, launch, project switch, layout) regenerates every id via `cloneSnapshot`, so panes remount with fresh sessions: layout comes back, stale processes don't. Each tab's layout is a tree of `split` nodes and `panel` leaves. [LayoutView.tsx](frontend/src/components/LayoutView.tsx) renders that tree recursively with `react-resizable-panels` v4 (`Group`/`Panel`/`Separator`, not the v2 `PanelGroup` API); panes show a header only when the tab is split. Tab titles are derived from the focused pane unless the user renamed the tab. `openTool` reuses an existing single-tool tab rather than opening duplicates (terminals always open fresh). Inactive tabs stay mounted but hidden so their sessions survive tab switches.
- **Drag and drop** uses native HTML5 events (no library):
  - The payload being dragged lives in `useUi().drag`, set by `dragSource()` in [store/ui.ts](frontend/src/store/ui.ts), so drop targets know what's coming during `dragover`.
  - While a drag is active, each pane mounts a `DropOverlay` ([LayoutView.tsx](frontend/src/components/LayoutView.tsx)). It sits above iframes, xterm and Monaco, which otherwise swallow drag events.
  - The overlay picks an edge (dock) or the centre (swap, panes only) and calls `useWorkspace().drop`. Tabs reorder via `moveTab`.
  - Layout changes go through `normalize()`, which merges same-direction nested splits.
  - Drop handlers must compute positions from the drop event itself, not from state set in `dragover`.
- Panes are `@container`s. Panels hide secondary UI by pane width with container variants (`wideOnly` = `@max-xl:hidden` in ui.tsx), not by window breakpoints.
- Tools are registered in [src/panels/registry.tsx](frontend/src/panels/registry.tsx) (label, lucide icon, sidebar section, component): add the kind to `PanelKind`, then register it. The sidebar, palette and menus pick it up automatically.
- **Every user action is defined once in [src/commands.ts](frontend/src/commands.ts)**: the keyboard handler, command palette and Settings › Shortcuts all read it. Add actions there, not as ad-hoc key handlers. Shortcut modifier: ⌘ on macOS, Ctrl+Shift elsewhere (plain Ctrl stays free for the shell). Commands with `alt: true` (pane focus) use Alt/⌘⌥ + Arrow instead, because Ctrl+Shift+Arrow is word selection in PowerShell. Users can remap keys (`keyFor()` reads `settings.keymap`).
- Terminal panes register a `TerminalApi` in the `terminals` map ([Terminal.tsx](frontend/src/components/Terminal.tsx)) keyed by pane id; commands and other panels use it (find, clear, write). `openTerminalWith(cmd)` opens a tab with a command typed but not run.
- **UI kit:** build panels from [src/ui.tsx](frontend/src/ui.tsx) (`IconButton`, `Button`, `Segmented`, `Toolbar`, `ListRow`, `Badge`, `StatusDot`, `field`/`th`/`td`/`row` classes) and lucide icons, not text glyphs. Colours are Tailwind `@theme` tokens in [src/style.css](frontend/src/style.css): `bg`, `surface`, `border`, `text`, `muted`, `accent`, plus `danger`/`warning`/`success` (derived from each theme's ANSI palette). Never hard-code palette colours like `red-400`. Use `bg-text/5` and `bg-text/10` for hover and selected states so they work on light themes.
- **Visual language is macOS 26 (Tahoe):**
  - Floating `glass` chrome (a CSS utility in style.css: sidebar, toolbar capsules, menus, palette) over a theme-tinted wallpaper gradient, with panes as `card`s.
  - Capsule buttons, a segmented control with a raised thumb, and zebra table rows.
  - Settings is System Settings-style: coloured `Tile` icons and `Group`/`GroupRow` forms.
  - Fonts are bundled (Inter for UI, JetBrains Mono for code) so every OS renders the same.
  - The `dark:` variant follows the active theme's scheme (`data-scheme` on `<html>`), not the OS.
- [Terminal.tsx](frontend/src/components/Terminal.tsx) renders xterm.js, subscribes to `pty:data`, then calls `StartTerminal` (listener first, to avoid missing output), forwards keystrokes via `WriteInput`, and refits via a `ResizeObserver` on its container, calling `Resize`. Because the backend has one PTY, all terminal panels currently mirror the same shell. It also has a find bar (`@xterm/addon-search`, needs `allowProposedApi`) and a right-click menu.
- Themes ([src/themes.ts](frontend/src/themes.ts), one row per theme: UI colours plus 16 ANSI colours) are applied by overriding the `--color-*` CSS variables at runtime ([store/theme.ts](frontend/src/store/theme.ts)). Terminal profiles ([store/profiles.ts](frontend/src/store/profiles.ts): shell, args, cwd, env, theme, font, cursor) attach to terminal panels via `profileId` on the layout node; a missing id means the default profile. Both stores persist to localStorage. Themes and profiles are edited in the Settings sheet ([components/Settings.tsx](frontend/src/components/Settings.tsx)), not in panels.
- **Gotchas found the hard way:**
  - Don't define components inside a component's render (`const Row = () => …`). Every pane `mousedown` focuses the pane, and a nested component gets a new identity on each render, so React rebuilds it mid-click and the click is lost. Use a render function (`renderRow(c)`) instead.
  - Effects must not return a value: write `useEffect(() => { el.scrollTo(…); })` with braces. Current Chromium's `scrollTo` returns a Promise, and returning it crashes React ("destroy is not a function").
  - A shared `Toolbar` clips overflow; a toolbar that hosts a dropdown needs `className="!overflow-visible"`.
  - Zustand v5 selectors must return stable values: `useStore((s) => s.list.filter(…))` creates a new array each call and loops forever ("Maximum update depth exceeded"). Select the raw field, then filter outside.
  - `glass` (backdrop-filter) creates a stacking context, so menus inside glass chrome can end up under later positioned content; the title bar is `relative z-30` for this reason.
- **Extensions** ([store/extensions.ts](frontend/src/store/extensions.ts), [panels/Extension.tsx](frontend/src/panels/Extension.tsx)): HTML panels in a sandboxed iframe (`allow-scripts` only), talking via `postMessage` (theme in, `toast` out; source-checked). Extension panes are `kind: 'extension'` with `extensionId` on the layout node. The same store holds `disabledTools`; use `enabledTools()` from the registry rather than iterating `panels` directly.
  - Markdown from files is rendered through DOMPurify (the webview can call Go). `dompurify` is a direct dependency that also overrides Monaco's copy (`"overrides": { "dompurify": "$dompurify" }`) to keep the patched version.
- `frontend/bindings/` is **generated** by Wails from exported methods on registered Go services. After changing a service's exported methods/signatures, regenerate (`wails3 generate bindings`; `task dev` does this automatically) rather than hand-editing.
- `greetservice.go` is leftover template code and is not registered in `main.go`.
- `build/` holds platform packaging config (Windows NSIS/MSIX, macOS plist, Android/iOS projects, Docker); `build/config.yml` is the Wails dev/build config.
