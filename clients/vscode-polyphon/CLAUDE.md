# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project

VS Code extension that connects to a running [Polyphon](https://github.com/polyphon-ai/polyphon) instance for multi-voice AI conversations, with code context awareness.

## Build & Development

```sh
npm install
npm run build          # type-check (tsc --noEmit) then esbuild production bundles
npm run dev            # esbuild one-shot build (non-production)
npm run package        # build + vsce package → .vsix
npm run lint           # eslint src/
```

**Development mode (recommended):** Open this folder (not the parent `polyphon-ai/` directory) in VS Code and press **F5**. This runs `npm run dev`, then launches an Extension Development Host window with the extension loaded from source. After making changes, run `npm run dev` in the terminal and press **Cmd+R** in the host window to reload — no reinstall needed.

**Install from VSIX:**
1. `npm run build`
2. `npm run package` to produce a `.vsix`
3. In VS Code: Extensions → ⋯ → Install from VSIX

## Architecture

```
src/
  extension.ts          # Activate/deactivate, register views, commands, status bar
  PolyphonManager.ts    # PolyphonClient lifecycle — connect, reconnect, settings watch
  SidebarProvider.ts    # WebviewViewProvider — orchestrates extension↔webview messages, API calls
  StatusBarItem.ts      # Connection indicator in the VS Code status bar
  context.ts            # Code context helpers (active file, selection, diagnostics)
  webview/
    index.ts            # Webview bundle entry — DOM setup, message handling (NO vscode imports)
    ConversationView.ts # Multi-voice thread renderer (NO vscode or Node imports)
    parseMention.ts     # @VoiceName mention extraction
media/
  icon.svg              # Monochrome activity bar icon
  style.css             # Webview styles using VS Code CSS variables (--vscode-*)
dist/
  extension.js          # Extension host bundle (CJS, Node)
  webview.js            # Webview bundle (IIFE, browser)
```

## Two-bundle build

esbuild produces two separate bundles:
- **Extension host** (`src/extension.ts` → `dist/extension.js`): CJS, Node platform, `vscode` and Node builtins are external
- **Webview** (`src/webview/index.ts` → `dist/webview.js`): IIFE, browser platform, no Node APIs

The `@polyphon-ai/js` SDK (uses `node:net`) is only imported in the extension host — never in the webview.

## Extension ↔ Webview message protocol

All communication is via `postMessage`. See `SidebarProvider.ts` for messages sent to the webview and `src/webview/index.ts` for messages sent back.

**Extension → Webview:** `state`, `profile`, `compositions`, `sessions`, `sessionCreated`, `voices`, `messages`, `userMessage`, `showPending`, `chunk`, `streamDone`, `streamError`, `sendEnabled`, `prefillInput`, `focusCompositionSelect`

**Webview → Extension:** `ready`, `reconnect`, `selectComposition`, `newSession`, `selectSession`, `send`

## Key design notes

- Requires Polyphon to already be running on port 7432 (configurable)
- Connection auto-starts on activation; auto-reconnects every 5 seconds on drop
- Sessions are created with `source: 'vscode'` and filtered to show only VS Code sessions in the sidebar
- Code context (file path, selection, diagnostics) is attached to the message content when the user enables it — the webview displays only the plain user text
- `ConversationView.ts` and `parseMention.ts` are intentionally free of VS Code and Node.js imports

## Settings

| Setting | Default | Description |
|---|---|---|
| `polyphon.host` | `127.0.0.1` | Polyphon API host |
| `polyphon.port` | `7432` | Polyphon API port |
| `polyphon.token` | `""` | API token (use 'Polyphon: Read Local API Token' to auto-populate) |

## Ecosystem

Part of the polyphon-ai workspace. See `../CLAUDE.md` for how all projects relate.
