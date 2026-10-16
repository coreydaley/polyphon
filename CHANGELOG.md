# Changelog

Release notes for Polyphon, recovered from the posts on the former polyphon.ai website.
Versions without an entry here were not announced there; see the [GitHub releases](https://github.com/coreydaley/polyphon/releases) for tagged builds. Launch and announcement posts from the same site are in [`history/`](history/).

> **Note:** Releases from v0.8.0 through v0.13.1 describe SQLCipher whole-database encryption. A build defect meant the packaged app shipped a stock SQLite driver, so the database was never actually encrypted in those releases.

## [0.13.1] - 2026-03-27

### Improved
- Internal tooling and dependency updates

## [0.12.0] - 2026-03-26

### What's New
- Each voice in a composition can now have its own YOLO mode override, letting you control autonomy per-voice rather than globally
- Sessions now track their source (e.g. polyphon, poly CLI, Obsidian) and the sessions page has a filter dropdown to view sessions by source
- The TCP API now exposes an OpenRPC 1.3 machine-readable spec via `api.getSpec`, accessible without authentication — useful for IDE integrations and tooling
- The TCP API now includes a `settings.getUserProfile` endpoint
- The API Settings page shows a spec discovery info block with the `api.getSpec` endpoint URL

### Fixed
- YOLO flags are now injected in the correct position for each CLI voice provider

## [0.11.0] - 2026-03-25

Polyphon v0.11.0 is now available.

### Improved
- Release workflow no longer deletes old releases — all previous versions remain available for download
- Community health files (contributing guide, code of conduct, security policy) polished for the public repo
- LICENSE file renamed so GitHub correctly detects the Apache 2.0 license on the repository page

## [0.9.1] - 2026-03-25

Polyphon v0.9.1 is now available.

### What's New
- `poly sessions new --composition <id>` creates a session from the terminal, with optional `--name`, `--working-dir`, and `--sandbox` flags
- `poly status` now shows the poly and Polyphon versions, active client count, token fingerprint, remote access status, and per-provider CLI availability alongside API key status
- The API's `getStatus` response now includes active connection count and CLI tool availability per provider

### Improved
- `make dev-poly` builds and globally links the poly CLI for local development; `make dev-poly-unlink` removes it

## [0.9.0] - 2026-03-24

Polyphon v0.9.0 is now available.

### What's New
- New TCP API server — enable it in Settings → API Server to control Polyphon
  programmatically from the terminal or over a network
- New `poly` CLI (`@polyphon-ai/poly`) — manage compositions, sessions, and
  conversations from the terminal; broadcast prompts, stream responses, search
  messages, and connect to remote Polyphon instances
- API Server settings tab — configure the API server, view connection details,
  and manage authentication from within the app

## [0.8.0] - 2026-03-23

Polyphon v0.8.0 is now available.

### What's New
- MCP Server: Polyphon can now run as an MCP tool server, letting AI agents (Claude, Codex, etc.) orchestrate your compositions programmatically
- Five MCP tools available: list compositions, create sessions, broadcast to all voices, ask a specific voice, and retrieve session history
- Run headlessly with `polyphon --mcp-server --headless` for use in agent workflows, or enable the in-process server from Settings → MCP Server
- New Settings tab to toggle the MCP server on/off with a live Running status indicator and connect instructions

### Improved
- Session round execution refactored to support both GUI and headless modes without requiring a browser window
- Database passphrase and other runtime secrets are now redacted from logs

## [0.7.1] - 2026-03-23

Polyphon v0.7.1 is now available.

### Improved
- Stability and reliability improvements

## [0.7.0] - 2026-03-23

Polyphon v0.7.0 is now available.

### What's New
- Full text search across all your sessions — open Search in the sidebar,
  type at least two characters, and results appear instantly with highlighted
  snippets showing which session and voice each match came from
- Per-session search with Cmd+F — opens an inline search bar at the top of
  the message feed with match navigation (Enter / Shift+Enter / ↑↓) and a
  live counter showing your position (e.g. "1 of 3 messages")
- Click any global search result to jump directly to the matching message
  in its session

## [0.6.0] - 2026-03-23

Polyphon v0.6.0 is now available.

### What's New
- The local database is now encrypted at the whole-database level using SQLCipher AES-256. Every byte on disk — messages, sessions, compositions, API configs, and settings — is ciphertext, not just selected fields.

### Improved
- Replaced the previous field-level AES-256-GCM encryption with SQLCipher whole-database encryption. Indexes, metadata, and all table data are now encrypted uniformly, removing the distinction between "encrypted" and "unencrypted" columns.

### ⚠️ Data Migration Notice
- On first launch, Polyphon detects any existing unencrypted database from a prior version and replaces it with a fresh encrypted one. **Existing conversation history will not be carried over.** Back up your data directory before upgrading if you want to preserve it.

## [0.5.0] - 2026-03-22

Polyphon v0.5.0 is now available.

### What's New
- API voices (Anthropic, OpenAI, OpenAI-compatible) can now use filesystem tools — read files, write files, list directories, search file contents, fetch URLs, and more
- Set a working directory on a session to give voices context about which files to work with
- Enable sandboxing to restrict API voices to only access files within the working directory
- The UI warns you when a session uses CLI voices with sandboxing enabled, since CLI voices run outside the sandbox
- Export any session transcript as Markdown, JSON, or plain text from the session header menu

### Fixed
- Session header and message bubble layout polish

### Improved
- Tool path resolution now works correctly for unsandboxed sessions with a working directory set

## [0.4.1] - 2026-03-21

Polyphon v0.4.1 is now available.

### Fixed
- Switching from the Preview channel back to Stable now reliably shows the update banner, even if you were on a pre-release version newer than the current stable
- App icon no longer has a stray dot in the center of the wave pattern

## [0.3.1] - 2026-03-20

Polyphon v0.3.1 is now available.

## What's New

- Each database migration is now applied atomically — the schema version bump and the migration itself commit together, so a crash mid-migration leaves the database in a clean, re-runnable state
- Fixed an edge case where duplicate-column migrations could fail after a partial-migration crash

## [0.3.0] - 2026-03-20

Polyphon v0.3.0 is now available — the first stable release in the 0.3 series.

This release graduates everything from the v0.3.0 alpha cycle into a stable build, including in-app auto-updates, encryption at rest, YOLO mode, and a significantly hardened security foundation.

## What's New

- In-app auto-update powered by electron-updater with channel support (stable, alpha, beta)
- Update download errors are now surfaced in the UI
- app-update.yml is bundled into the packaged app as an extra resource
- Pre-release flag is preserved correctly for alpha and beta GitHub releases
- Added RELEASE_NOTES.md as the source of truth for GitHub release bodies

## Fixes

- Fixed updater error surfaces and allowPrerelease handling for pre-release installs
