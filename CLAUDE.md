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
- Frontend workspace: [src/store/workspace.ts](frontend/src/store/workspace.ts) (Zustand) holds tabs. Each tab's layout is a tree of `split` nodes and `panel` leaves. [LayoutView.tsx](frontend/src/components/LayoutView.tsx) renders that tree recursively with `react-resizable-panels` v4 (`Group`/`Panel`/`Separator`, not the v2 `PanelGroup` API). Panel types are registered in [src/panels/registry.tsx](frontend/src/panels/registry.tsx): add the kind to `PanelKind`, then register its component. Inactive tabs stay mounted but hidden so their sessions survive tab switches. Keyboard shortcuts are handled in [pages/Workspace.tsx](frontend/src/pages/Workspace.tsx). Theme colours are Tailwind `@theme` tokens in [src/style.css](frontend/src/style.css) (`bg-bg`, `bg-surface`, `text-accent`, …).
- [Terminal.tsx](frontend/src/components/Terminal.tsx) renders xterm.js, subscribes to `pty:data`, then calls `StartTerminal` (listener first, to avoid missing output), forwards keystrokes via `WriteInput`, and refits via a `ResizeObserver` on its container, calling `Resize`. Because the backend has one PTY, all terminal panels currently mirror the same shell.
- `frontend/bindings/` is **generated** by Wails from exported methods on registered Go services. After changing a service's exported methods/signatures, regenerate (`wails3 generate bindings`; `task dev` does this automatically) rather than hand-editing.
- `greetservice.go` is leftover template code and is not registered in `main.go`.
- `build/` holds platform packaging config (Windows NSIS/MSIX, macOS plist, Android/iOS projects, Docker); `build/config.yml` is the Wails dev/build config.
