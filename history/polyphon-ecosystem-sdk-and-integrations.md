# The Polyphon Ecosystem: SDK, CLI, Obsidian Plugin, and VS Code Extension

_Originally published on polyphon.ai, 2026-03-27._

{{< figure-float src="polyphon-ecosystem-sdk-and-integrations.webp" alt="Glowing amber sphere connected by luminous blue circuit pathways to three laptop terminals on dark navy background." >}}

## The real product was never just the window on your screen.

The interesting part was the workflow behind it: a persistent composition of voices, a shared conversation, and a way to return to that conversation from wherever your work actually happens. Sometimes that is the desktop app. Sometimes it is a shell script. Sometimes it is the note you already have open in Obsidian.

Polyphon's next step is not another isolated feature. It is the same system becoming available through four new entry points: the **`@polyphon-ai/js` SDK**, the **`poly` CLI**, the **`obsidian-polyphon`** plugin, and the **`vscode-polyphon`** extension.

## One engine, multiple surfaces

The desktop app remains where most people will create compositions, tune voices, and configure providers. But once Polyphon is running, it exposes a local API that other clients can connect to.

That changes the shape of the product in an important way. The intelligence lives in the shared system, not in any single client. A session you start from the terminal shows up in the desktop app. A session you resume in Obsidian uses the exact composition you built earlier. Your compositions and sessions are no longer trapped inside one interface — they follow you across the tools where your work actually happens.

## The SDK: `@polyphon-ai/js`

```sh
npm install @polyphon-ai/js
```

`@polyphon-ai/js` is a typed TypeScript client for the Polyphon API. It removes the socket-management work so you can script workflows against Polyphon instead of rebuilding client plumbing.

```ts
import { PolyphonClient, readLocalToken } from '@polyphon-ai/js';

const client = new PolyphonClient({
  token: readLocalToken(), // reads from ~/Library/Application Support/Polyphon/api.key
});

await client.connect();

const compositions = await client.compositions();
const session = await client.createSession(compositions[0].id, 'release-script');

await client.broadcast(
  { sessionId: session.id, content: 'Summarize the trade-offs in this draft.' },
  ({ voiceName, delta }) => process.stdout.write(delta),
);

client.disconnect();
```

`readLocalToken()` finds the authentication key Polyphon writes to your app data directory automatically — no manual token setup required for local use.

The API surface covers compositions, sessions, broadcast and directed prompts, streaming deltas, session export, message search, and provider status. The SDK version always matches the Polyphon app version: install `@polyphon-ai/js@0.13.x` for Polyphon `0.13.x`. For testing, `@polyphon-ai/js/testing` exports `MockPolyphonServer` — a full in-process server that speaks the wire protocol, so you can test your integration without a running desktop app in CI.

## The CLI: `poly`

```sh
npm install -g @polyphon-ai/poly
```

`poly` is for the moments when opening the full app is unnecessary friction. It is also built entirely on `@polyphon-ai/js` — the first production consumer of the SDK — which makes it a useful proof that the SDK works well for real integrations.

```sh
# Confirm Polyphon is reachable
poly status

# List saved compositions
poly compositions list

# Create a session, then run a prompt and stream the response
SESSION=$(poly sessions new --composition <id> --format json | jq -r '.id')
poly run --session $SESSION --prompt "$(git diff HEAD~1)" --stream
```

`poly run` broadcasts to all voices in the session. `poly ask` directs a message to a specific voice. Both support `--stream` for live token output and `--format json` for structured output you can pipe elsewhere.

Named remotes and environment variables let `poly` reach a Polyphon instance running on a different machine:

```sh
poly remote add home-server --host 192.168.1.10 --token-file ~/.polyphon/home.key
poly --remote home-server compositions list
```

This makes it practical to keep Polyphon running on the machine you prefer and control it from anywhere.

## The Obsidian Plugin: `obsidian-polyphon`

The Obsidian plugin is the clearest example of why shared state matters — and probably the most immediately legible one for people who do not write scripts.

Plenty of people think with AI in one place and write in another. That context switching adds up. `obsidian-polyphon` brings a Polyphon conversation into the Obsidian sidebar, so the discussion can happen alongside the note you are already working in.

Once connected to your running Polyphon instance, the plugin lets you choose a composition, create or resume a session, and send prompts. Multi-voice responses stream into the sidebar with each voice labeled. What makes this feel different from configuring a new AI integration is that you are using the same compositions you already built in Polyphon. The voices, the tones, the system prompt templates, the conductor profile — all of it carries over. You are not setting up a new AI tool. You are bringing the one you already have into your notes.

The practical pattern: keep a live multi-voice discussion beside a draft, a meeting note, or a research document, without switching windows.

## The VS Code Extension: `vscode-polyphon`

The VS Code extension brings the same idea into the editor where most development work actually happens.

Once connected to your running Polyphon instance, a sidebar panel lets you pick a composition, create or resume a session, and send prompts without leaving the editor. Multi-voice responses stream in with each voice labeled. You can attach context directly from the editor: the current file, a selection, or the active diagnostics — so the conversation is grounded in the exact code you are looking at.

A few details that make this feel different from a generic AI chat panel:

- **@mention autocomplete** lets you reference specific voices mid-prompt, directing a message to one voice without breaking out of the conversation flow.
- **"Ask About Selection"** appears in the right-click context menu, so you can send highlighted code to your current session in one step.
- **The status bar indicator** shows connection state at a glance, so you always know whether the extension is live before you start typing.

Like the Obsidian plugin, you are not configuring a new AI tool. You are using the compositions you already built in Polyphon — the same voices, the same conductor profile — now surfaced beside your code.

## Four ways into the same system

Taken together, these four launches reflect what Polyphon is becoming. Each one maps to a distinct job:

- **SDK**: build something new — scripts, automations, internal tools
- **CLI**: automate or script what you already do, without writing a full application
- **Obsidian plugin**: bring the conversation into the writing environment where you already think
- **VS Code extension**: keep the conversation beside the code you are actively writing

Configure in the app. Script from the terminal. Think in your vault. Code in your editor. Return to the desktop UI when you want the full visual context. It is one underlying conversation model — not four separate products.

## A few places to start

- Pipe `git diff HEAD~1` into `poly run --stream` with a composition tuned for code review, before you open a pull request.
- Turn a recurring multi-voice prompt workflow into a small Node.js script with the SDK — five to ten lines with streaming handled.
- Open the Obsidian plugin alongside a draft you are actively working on and keep the conversation in view while you write.
- Right-click a failing function in VS Code, select "Ask About Selection," and send it straight to your current session.

The API reference is at [coreydaley.dev/projects/polyphon/docs/for-developers/api](https://coreydaley.dev/projects/polyphon/docs/for-developers/api/). The SDK source is at [polyphon-ai/polyphon-js](https://github.com/polyphon-ai/polyphon-js). The Obsidian plugin is at [polyphon-ai/obsidian-polyphon](https://github.com/polyphon-ai/obsidian-polyphon). The VS Code extension is at [polyphon-ai/vscode-polyphon](https://github.com/polyphon-ai/vscode-polyphon).

**[Download Polyphon](https://github.com/coreydaley/polyphon/releases/latest)** — everything else connects to it.

---

*Where would you bring Polyphon first: into your scripts, your notes, your editor, or something else entirely?*
