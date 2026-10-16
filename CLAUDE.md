# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project

Obsidian plugin that connects to a running [Polyphon](https://github.com/polyphon-ai/polyphon) instance for multi-voice AI conversations.

## Build & Development

```sh
npm install
npm run build            # type-check (tsc --noEmit) then esbuild production bundle
npm run dev              # esbuild watch mode (auto-copies to vault/.obsidian/plugins/polyphon/)
npm test                 # all tests (vitest)
npm run test-unit        # unit tests only
npm run test-integration # integration tests (requires a running Polyphon instance)
npm run lint             # eslint src/
```

TypeScript type-checking is the primary correctness gate — always run `npm run build` before committing.

**Installing the plugin**: Copy `main.js`, `manifest.json`, and `styles.css` to `<vault>/.obsidian/plugins/polyphon/` and enable it in Obsidian settings.

**Dev vault symlink**: Place (or symlink) a test vault at `vault/` in the project root. The dev build will auto-copy `main.js` and `styles.css` there on each rebuild.

## Architecture

```
src/
  main.ts                 # Plugin entrypoint — registers view, ribbon, commands, settings
  settings.ts             # PolyphonSettingTab — host/port/token config
  types.ts                # Shared types (mirrors Polyphon's shared/api.ts and shared/types.ts)
  PolyphonClient.ts       # TCP JSON-RPC client + stream.chunk listener (NO Obsidian imports)
  PolyphonSidebarView.ts  # ItemView — connection lifecycle, composition/session management
  ConversationView.ts     # Multi-voice thread renderer (NO Obsidian imports)
  styles.css
```

`PolyphonClient.ts` and `ConversationView.ts` are intentionally free of Obsidian imports — they are the seed of a future `@polyphon-ai/client` SDK package.

## Key design notes

- The plugin requires Polyphon to already be running — it does not attempt to launch it
- Connection is attempted on sidebar open and on settings save
- `voice.broadcast` is used for all user messages (sends to all voices in the composition)
- Streaming is handled via `stream.chunk` JSON-RPC notifications over the same TCP socket
- Each voice response is rendered as a labeled message in a unified thread

## API contract with polyphon

`src/types.ts` **manually mirrors** `polyphon/src/shared/api.ts` and `polyphon/src/shared/types.ts`. There is no shared npm package — the types are duplicated by design to keep this plugin free of runtime dependencies on the main app.

When the Polyphon TCP API changes:
1. Update `src/types.ts` to match the new shapes
2. Update the API reference in `coreydaley-dev/content/projects/polyphon/docs/for-developers/api.md`

The default API port is **7432**. Users configure host/port in the plugin settings tab.

## Ecosystem

This project is part of the polyphon-ai workspace. See `../.github/CLAUDE.md` for how the projects relate to each other.
