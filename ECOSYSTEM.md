# Polyphon ecosystem

How the Polyphon repositories relate to each other. Each repository has its own `CLAUDE.md` with project-specific details. (Moved here from the former `polyphon-ai/.github` org repo.)

## Projects

| Repository | Purpose | Stack |
|---|---|---|
| [`polyphon`](https://github.com/coreydaley/polyphon) | Core Electron desktop app | TypeScript, React 19, Electron 41, SQLCipher |
| [`polyphon-js`](https://github.com/coreydaley/polyphon-js) | JavaScript/TypeScript SDK | TypeScript, Node.js, published as `@polyphon-ai/js` |
| [`obsidian-polyphon`](https://github.com/coreydaley/obsidian-polyphon) | Obsidian plugin client | TypeScript, Obsidian Plugin API |
| [`vscode-polyphon`](https://github.com/coreydaley/vscode-polyphon) | VS Code extension | TypeScript, VS Code Extension API |
| [`coreydaley-dev`](https://github.com/coreydaley/coreydaley-dev) (`content/projects/polyphon/`) | Website and docs | Hugo, at coreydaley.dev/projects/polyphon/ |

## How They Interact

### polyphon → polyphon-js (SDK sync)

`polyphon` is the **complete source of truth** for everything in `polyphon-js/src/`. On each Polyphon release, the `sync-sdk.yml` workflow copies all SDK files to `polyphon-js`, bumps the SDK version to match, and publishes `@polyphon-ai/js` to npm.

| polyphon source | polyphon-js destination |
|---|---|
| `src/shared/types.ts`, `src/shared/api.ts` | `src/types.ts`, `src/api.ts` |
| `src/sdk/client.ts`, `errors.ts`, `token.ts`, `index.ts` | `src/client.ts`, etc. |
| `src/sdk/testing/` | `src/testing/` |
| `src/sdk/**/*.test.ts` | `src/**/*.test.ts` |

SDK tests run in polyphon CI first (against the real server implementation) before syncing, ensuring correctness before each publish.

### polyphon ↔ obsidian-polyphon / vscode-polyphon (API contract)

`polyphon` exposes a **JSON-RPC 2.0 TCP API** on port 7432 (default). Both the Obsidian plugin and VS Code extension connect to this socket and call methods to authenticate, list compositions, manage sessions, and stream voice responses.

Both clients import types directly from `@polyphon-ai/js`, keeping them in sync with the SDK automatically. Sessions created by each client are tagged with a `source` field (`"obsidian"` or `"vscode"`) so each client only surfaces its own sessions in its UI.

Key API methods:

| Method | Purpose |
|---|---|
| `api.authenticate` | Auth with token from `~/Library/Application Support/Polyphon/api.key` |
| `compositions.list` / `compositions.get` | Fetch compositions |
| `sessions.list` / `sessions.create` / `sessions.get` | Manage sessions |
| `sessions.messages` / `sessions.rename` / `sessions.export` | Session operations |
| `voice.broadcast` | Send a message; streams `stream.chunk` notifications back |
| `settings.getUserProfile` | Fetch conductor profile |

### Website and docs (coreydaley-dev)

The site lives in the [`coreydaley-dev`](https://github.com/coreydaley/coreydaley-dev) repo under `content/projects/polyphon/` and is served at coreydaley.dev/projects/polyphon/. Its Download button links to GitHub's latest release, so releases need no site change. It hosts the user-facing docs for every client project:
- `docs/polyphon/` — main app docs
- `docs/integrations/obsidian-polyphon/` — Obsidian plugin docs
- `docs/integrations/vscode-polyphon/` — VS Code extension docs
- `docs/for-developers/api.md` — full JSON-RPC API reference
- `docs/for-developers/mcp.md` — MCP server docs

When API contracts or features change in any project, update the relevant docs there.

## Cross-Project Workflows

### Adding a new API method to polyphon
1. Implement in `polyphon/src/main/api/`
2. Add types to `polyphon/src/shared/api.ts`
3. Update `MockPolyphonServer` in `polyphon/src/sdk/testing/MockPolyphonServer.ts` to handle the new method
4. Add tests in `polyphon/src/sdk/client.test.ts`
5. On release, `sync-sdk.yml` automatically syncs everything to `polyphon-js` and publishes
6. Update `coreydaley-dev/content/projects/polyphon/docs/for-developers/api.md`

### Releasing a new version
1. Bump version in `polyphon` with `make bump-version VERSION=x.y.z`
2. Run `release.yml` — signs, notarizes, and publishes the macOS DMG
3. Add the release notes to `CHANGELOG.md`

### Updating client documentation
- App docs: `coreydaley-dev/content/projects/polyphon/docs/polyphon/`
- Obsidian plugin docs: `coreydaley-dev/content/projects/polyphon/docs/integrations/obsidian-polyphon/`
- VS Code extension docs: `coreydaley-dev/content/projects/polyphon/docs/integrations/vscode-polyphon/`
- API reference: `coreydaley-dev/content/projects/polyphon/docs/for-developers/api.md`

## Default Ports

| Service | Port |
|---|---|
| Polyphon JSON-RPC TCP API | 7432 |
