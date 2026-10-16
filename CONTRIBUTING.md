# Contributing

## Prerequisites

- Node.js 20+
- VS Code 1.85+
- [Polyphon](https://polyphon.ai) installed and running locally for manual testing

## Development setup

```sh
npm install
npm run dev     # one-shot build (non-production)
npm run build   # type-check + production build
```

To launch an Extension Development Host with the extension loaded, open this folder in VS Code and press **F5** (or run **Debug: Start Debugging**). This opens a new VS Code window with the extension active.

## Project structure

See `CLAUDE.md` for a full architecture overview. The short version:

- `src/extension.ts` — activation entry point, registers everything
- `src/PolyphonManager.ts` — client lifecycle, reconnect logic, settings watching
- `src/SidebarProvider.ts` — `WebviewViewProvider`, orchestrates API calls and the extension↔webview message bridge
- `src/StatusBarItem.ts` — connection indicator in the status bar
- `src/context.ts` — gathers code context (active file, selection, diagnostics)
- `src/webview/` — browser-only bundle (no VS Code or Node.js imports)
  - `index.ts` — DOM setup and message handling
  - `ConversationView.ts` — multi-voice thread renderer
  - `parseMention.ts` — `@VoiceName` extraction
- `media/icon.svg` — monochrome activity bar icon
- `media/style.css` — webview styles using VS Code CSS variables

## Build system

Two esbuild bundles are produced:

| Bundle | Entry | Output | Platform |
|--------|-------|--------|----------|
| Extension host | `src/extension.ts` | `dist/extension.js` | Node (CJS) |
| Webview | `src/webview/index.ts` | `dist/webview.js` | Browser (IIFE) |

`vscode` and Node built-ins are external in the extension host bundle. The `@polyphon-ai/js` SDK (which uses `node:net`) is bundled into the extension host and never imported in the webview.

## Packaging

```sh
npm run package   # produces vscode-polyphon-x.y.z.vsix
```

Install locally in VS Code: **Extensions → ⋯ → Install from VSIX…**

## Contributing

This repository is not currently accepting pull requests. If you have ideas, feedback, or want to discuss a change, open a [GitHub issue](https://github.com/coreydaley/vscode-polyphon/issues) or an issue instead.
