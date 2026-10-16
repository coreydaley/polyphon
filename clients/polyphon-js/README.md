# @polyphon-ai/js

[![npm](https://img.shields.io/npm/v/@polyphon-ai/js)](https://www.npmjs.com/package/@polyphon-ai/js) [![npm downloads](https://img.shields.io/npm/dm/@polyphon-ai/js)](https://www.npmjs.com/package/@polyphon-ai/js) [![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE) [![Follow on X](https://img.shields.io/badge/Follow-%40PolyphonAI-000?logo=x&logoColor=white)](https://x.com/intent/follow?screen_name=PolyphonAI)

JavaScript/TypeScript SDK for the [Polyphon](https://polyphon.ai) JSON-RPC API.

Connect to a running Polyphon instance, manage compositions and sessions, send messages to voices, and stream responses — all from Node.js or any bundler-based project.

> **This repository is auto-synced from [polyphon-ai/polyphon](https://github.com/polyphon-ai/polyphon).**
> All source files in `src/` are generated — do not open pull requests here.
> To contribute to the SDK, submit PRs to `polyphon-ai/polyphon` targeting the files under `src/sdk/` and `src/shared/`.

## Requirements

- Node.js ≥ 18
- A running [Polyphon](https://polyphon.ai) instance (the SDK connects to it over TCP)

## Installation

```sh
npm install @polyphon-ai/js
```

The SDK version always matches the Polyphon app version. Install the version that matches your Polyphon install (e.g. Polyphon `0.12.0` → `@polyphon-ai/js@0.12.0`).

## Quick start

```ts
import { PolyphonClient, readLocalToken } from '@polyphon-ai/js';

const client = new PolyphonClient({
  host: '127.0.0.1', // default
  port: 7432,        // default
  token: readLocalToken(), // reads from ~/Library/Application Support/Polyphon/api.key
});

await client.connect();

// List compositions
const compositions = await client.compositions();
const comp = compositions[0];

// Create a session
const session = await client.createSession(comp.id, 'my-app');

// Broadcast a message to all voices, streaming the response
const result = await client.broadcast(
  { sessionId: session.id, content: 'What is the capital of France?' },
  (chunk) => process.stdout.write(chunk.delta),
);

console.log('\nFinal messages:', result.messages);

client.disconnect();
```

## Authentication

Polyphon authenticates via a token stored in `~/Library/Application Support/Polyphon/api.key` (macOS). The SDK provides helpers to read it:

```ts
import { readLocalToken, defaultTokenPath } from '@polyphon-ai/js';

// Read the token from the default location
const token = readLocalToken();

// Or get the path and read it yourself
const path = defaultTokenPath(); // respects POLYPHON_DATA_DIR env var
```

## API

### `new PolyphonClient(options)`

| Option | Type | Default | Description |
|---|---|---|---|
| `token` | `string` | required | API token |
| `host` | `string` | `'127.0.0.1'` | Polyphon host |
| `port` | `number` | `7432` | Polyphon TCP port |

#### Lifecycle

```ts
await client.connect()     // connects and authenticates; throws RpcError on auth failure
client.disconnect()        // closes the socket
client.getState()          // 'idle' | 'connecting' | 'connected' | 'disconnected'

// EventEmitter events
client.on('disconnect', () => { /* reconnect or clean up */ })
client.on('error', (err: Error) => { /* socket error */ })
```

#### Compositions

```ts
client.compositions()                        // → Composition[]
client.getComposition({ id })                // → Composition
client.createComposition(params)             // → Composition
client.updateComposition(params)             // → Composition
client.deleteComposition({ id })             // → void
client.archiveComposition({ id, archived })  // → Composition
```

#### Sessions

```ts
client.sessions()                                       // → Session[]
client.getSession({ id })                               // → Session
client.createSession(compositionId, source, extra?)     // → Session
client.deleteSession({ id })                            // → void
client.renameSession({ id, name })                      // → Session
client.archiveSession({ id, archived })                 // → Session
client.getMessages({ sessionId })                       // → Message[]
client.exportSession({ sessionId, format })             // → { content, format }
```

#### Voices

```ts
// Broadcast to all voices in the session
client.broadcast({ sessionId, content }, onChunk?)  // → { messages }

// Ask a single voice
client.ask({ sessionId, voiceId, content }, onChunk?)  // → { message }

// Abort an in-progress response
client.abort({ sessionId })  // → { aborted }
```

The optional `onChunk` callback receives streaming deltas as they arrive:

```ts
client.broadcast(
  { sessionId: session.id, content: 'Hello' },
  ({ voiceId, voiceName, delta }) => {
    process.stdout.write(delta);
  },
);
```

#### Search

```ts
client.searchMessages({ query })  // → SearchMessagesResult[]
```

#### Settings & status

```ts
client.getUserProfile()      // → { conductorName, pronouns, conductorColor, conductorAvatar }
client.getApiStatus()        // → ApiGetStatusResult
client.getDebugInfo()        // → SettingsGetDebugInfoResult
client.getProviderStatus()   // → SettingsGetProviderStatusResult[]
client.getMcpStatus()        // → McpGetStatusResult
client.setMcpEnabled(params) // → McpGetStatusResult
```

### Error handling

All API errors are thrown as `RpcError`:

```ts
import { RpcError } from '@polyphon-ai/js';

try {
  await client.connect();
} catch (err) {
  if (err instanceof RpcError) {
    console.error(`RPC error ${err.code}: ${err.message}`);
  }
}
```

Common error codes are available as `RPC_ERROR` constants in `@polyphon-ai/js/api`:

```ts
import { RPC_ERROR } from '@polyphon-ai/js/api';
// RPC_ERROR.UNAUTHORIZED, RPC_ERROR.NOT_FOUND, RPC_ERROR.PARSE_ERROR, …
```

## Testing

Import `MockPolyphonServer` from `@polyphon-ai/js/testing` to test your integration without a running Polyphon instance. It speaks the full JSON-RPC wire protocol and streams responses word-by-word.

```ts
import { MockPolyphonServer } from '@polyphon-ai/js/testing';
import { PolyphonClient } from '@polyphon-ai/js';

const server = new MockPolyphonServer({ token: 'test-token', streamingDelayMs: 0 });
await server.start();

const client = new PolyphonClient({ port: server.port, token: 'test-token' });
await client.connect();

const sessions = await client.sessions();
const result = await client.broadcast({ sessionId: sessions[0].id, content: 'Hi' });
// result.messages contains voice responses from DEFAULT_COMPOSITION voices

await server.stop();
```

### MockPolyphonServer options

| Option | Type | Default | Description |
|---|---|---|---|
| `token` | `string` | `'test-token'` | Required token for authentication |
| `streamingDelayMs` | `number` | `20` | Delay between streamed words (ms) |
| `responseTemplate` | `(voiceName, content) => string` | `"<name>: <first 50 chars>"` | Generates voice response text |

### Inspecting calls

```ts
server.calls('voice.broadcast')  // → array of params from every call to that method
server.clearCalls()              // reset call log between tests
```

### Simulating errors

```ts
server.simulateError('compositions.list', -32000, 'something went wrong');
// Next call to compositions.list will reject with that error (single-use)
```

### Default fixtures

The server starts with `DEFAULT_COMPOSITION` (two voices: Claude and GPT-4o) and `DEFAULT_SESSION`. Import fixtures directly if you need them in assertions:

```ts
import { DEFAULT_COMPOSITION, DEFAULT_SESSION, DEFAULT_MESSAGES } from '@polyphon-ai/js/testing';
```

## Types

All domain types and API shapes are exported from the main package:

```ts
import type {
  Composition, CompositionVoice, Session, Message,
  PolyphonClientOptions, ClientState,
  VoiceBroadcastParams, VoiceBroadcastResult,
  StreamChunkNotification,
  // … and more
} from '@polyphon-ai/js';
```

## Version policy

The SDK version always matches the Polyphon app version. This makes API compatibility unambiguous: install the version that matches your Polyphon install.

```sh
npm install @polyphon-ai/js@0.12.0  # for Polyphon 0.12.0
```

## Links

- [Polyphon website](https://polyphon.ai)
- [API reference](https://polyphon.ai/docs/for-developers/api)
- [GitHub](https://github.com/polyphon-ai/polyphon-js)
