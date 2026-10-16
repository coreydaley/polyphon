# Contributing

## Prerequisites

- Node.js 20+
- An Obsidian vault for manual testing
- At least one supported agent installed (Claude Code, Codex, or Copilot) **or** an API key for one of the providers

## Development setup

```sh
npm install
make dev        # builds and installs the plugin into the test vault at vault/
```

`make dev` runs `npm run build` and copies `main.js`, `manifest.json`, and
`styles.css` into `vault/.obsidian/plugins/obsidian-ai-agent-sidebar/`. Open
`vault/` as a vault in Obsidian to test.

For watch mode without the vault setup:

```sh
npm run dev     # esbuild watch (no type-check)
npm run build   # type-check + production bundle
```

## Project structure

See `CLAUDE.md` for a full architecture overview. The short version:

- `src/main.ts` — plugin entry point
- `src/AgentRunner.ts` — CLI process runner + file-op protocol parser
- `src/AgentApiRunner.ts` — streaming API runner + file-op protocol parser
- `src/runnerFactory.ts` — selects CLI vs API runner based on settings
- `src/providers/` — per-provider API adapters (Anthropic, OpenAI, Gemini, OpenAI-compatible)
- `src/settings.ts` — settings UI

## Testing

### Test suite overview

| Command | What it runs | Included in `make test` |
| --- | --- | --- |
| `make test-unit` | Unit tests (vitest, JSDOM) + unit config | Yes |
| `make test-integration` | Integration tests (real processes, ~15 s timeout) | Yes |
| `make test-e2e` | E2E tests against mock API servers (Playwright + Electron) | Yes |
| `make test-e2e-live` | Live E2E against real CLIs and real API keys | **No** |
| `make test-e2e-openai-compatible` | Live E2E via Docker/Ollama | **No** |

Run the standard suite (unit + integration + e2e) with:

```sh
make test
```

### Unit tests

```sh
make test-unit
# or
npm test && npm run test-unit
```

Tests in `tests/unit/` use JSDOM to test UI components (AgentChatTab). Run with `vitest.unit.config.ts`. No network or filesystem access required.

### Integration tests

```sh
make test-integration
# or
npm run test-integration
```

Tests in `tests/integration/` exercise real processes and environment (shell env resolution, file-op parsing, provider adapters). Requires the relevant CLI tools or API keys. Uses `vitest.integration.config.ts` with a ~15 s timeout.

To run a single integration test file:

```sh
npx vitest run --config vitest.integration.config.ts tests/integration/agent-api-runner.integration.test.ts
```

### E2E tests (mock servers)

```sh
make test-e2e
# or
npm run test-e2e
```

Tests in `tests/e2e/` drive Obsidian via Playwright's Electron API. They use mock API servers for provider responses, so no API keys or running agents are required. Tests are automatically skipped if Obsidian is not installed.

**Prerequisite**: Enable Obsidian's command-line interface before running:
1. Open Obsidian → Settings → General → Advanced
2. Enable **Command line interface**

Set `OBSIDIAN_BINARY=/path/to/Obsidian` to override the default binary path.

### Live E2E tests (`make test-e2e-live`)

```sh
make test-e2e-live
# or
npm run test-e2e-live
```

Tests in `tests/e2e-live/cli-agents.e2e-live.test.ts` and `tests/e2e-live/api-agents.e2e-live.test.ts` drive Obsidian against **real CLIs and real API keys**. These are excluded from `make test` and must be run explicitly.

#### Prerequisites

- Obsidian desktop app installed (macOS: `/Applications/Obsidian.app`)
- Obsidian must **not** be running when tests start
- Obsidian CLI mode enabled (Settings → General → Advanced → Command line interface)

**CLI agents** (`cli-agents.e2e-live.test.ts`):

- `claude` CLI installed and on PATH
- `codex` CLI installed and on PATH
- `copilot` CLI installed and on PATH (authenticate with `gh auth login`)

**API agents** (`api-agents.e2e-live.test.ts`):

Each agent reads API keys from your shell environment. Set these in your shell profile (`.zshrc`, `.bash_profile`, etc.) and restart your terminal before running.

| Agent | Environment variables (checked in order) |
| --- | --- |
| Claude (Anthropic) | `OBSIDIAN_AI_AGENT_SIDEBAR_ANTHROPIC_API_KEY`, `ANTHROPIC_API_KEY` |
| Codex (OpenAI) | `OBSIDIAN_AI_AGENT_SIDEBAR_OPENAI_API_KEY`, `OPENAI_API_KEY` |
| Gemini (Google) | `OBSIDIAN_AI_AGENT_SIDEBAR_GEMINI_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_API_KEY` |

#### Selectively skipping suites

Set any of the following environment variables to `1` to skip specific suites. Skipped suites do not count as failures.

| Variable | Effect |
| --- | --- |
| `SKIP_CLI=1` | Skip all CLI agent suites |
| `SKIP_API=1` | Skip all API agent suites |
| `SKIP_CLAUDE=1` | Skip all claude suites (CLI + API) |
| `SKIP_CODEX=1` | Skip all codex suites (CLI + API) |
| `SKIP_COPILOT=1` | Skip copilot suite |
| `SKIP_GEMINI=1` | Skip gemini suite |
| `SKIP_CLAUDE_CLI=1` | Skip claude CLI suite only |
| `SKIP_CLAUDE_API=1` | Skip claude API suite only |
| `SKIP_CODEX_CLI=1` | Skip codex CLI suite only |
| `SKIP_CODEX_API=1` | Skip codex API suite only |
| `SKIP_COPILOT_CLI=1` | Skip copilot CLI suite only |
| `SKIP_GEMINI_API=1` | Skip gemini API suite only |
| `SKIP_OPENAI_COMPAT=1` | Skip openai-compat suite |
| `SKIP_OPENAI_COMPAT_API=1` | Skip openai-compat API suite only |

Examples:

```sh
# Run only claude tests
SKIP_CODEX=1 SKIP_COPILOT=1 SKIP_GEMINI=1 make test-e2e-live

# Run only API tests (skip CLI)
SKIP_CLI=1 make test-e2e-live

# Run only claude CLI
SKIP_API=1 SKIP_CODEX=1 SKIP_COPILOT=1 SKIP_GEMINI=1 make test-e2e-live
```

Missing prerequisites (binary not installed, API key not set) cause the suite to **fail** with a descriptive error. Use the skip variables above to intentionally exclude a suite you can't run.

Expected runtime: 3–8 minutes depending on LLM latency and which suites run.

Failure screenshots are saved to `tests/e2e-live/artifacts/` (gitignored).

### OpenAI-Compatible E2E tests (`make test-e2e-openai-compatible`)

```sh
make test-e2e-openai-compatible
# or
npm run test-e2e-openai-compatible
```

Tests in `tests/e2e-live/openai-compat.e2e-live.test.ts` drive Obsidian against a local Ollama instance running in Docker. This suite is **excluded from both `make test` and `make test-e2e-live`** and must be run separately.

#### Prerequisites

- Docker Desktop installed and daemon running (`docker info` must succeed)
- Obsidian desktop app installed and CLI mode enabled
- Obsidian must **not** be running when tests start
- Port `11434` must be free — stop any local Ollama instance before running

#### Docker image and model

| Item | Value |
| --- | --- |
| Docker image | `ollama/ollama:0.6.5` |
| Model | `qwen2.5:1.5b` |
| Ollama port | `11434` (bound to `127.0.0.1` only) |
| Container name | `obsidian-e2e-ollama` |
| Model volume | `obsidian-e2e-ollama-models` (persists model across runs) |

#### Resource requirements

| Resource | Requirement |
| --- | --- |
| RAM | ~400–600 MB at runtime |
| Disk | ~700 MB for the Docker image + ~90 MB for the model (first run only) |
| GPU | Not required — runs on CPU |

#### First run vs subsequent runs

On first run, Docker pulls the `ollama/ollama:0.6.5` image (~700 MB) and then downloads the `qwen2.5:1.5b` model (~90 MB) into a named Docker volume (`obsidian-e2e-ollama-models`). Subsequent runs skip the download if the volume and model are already present. The `beforeAll` timeout is set to 5 minutes to accommodate the initial pull.

#### What the tests do

1. Start an Ollama container in Docker
2. Pull `qwen2.5:1.5b` into the container (skipped if already in the volume)
3. Wait for Ollama to be ready and warm up inference
4. Launch Obsidian with a temporary vault
5. Configure the OpenAI-compatible agent via the settings UI (Base URL: `http://127.0.0.1:11434/v1`, Model: `qwen2.5:1.5b`)
6. Send a chat message and assert a response is received
7. Send a file-create prompt and assert the file appears in the vault
8. Stop and remove the Ollama container

Failure screenshots and Docker logs are saved to `tests/e2e-live/artifacts/` (gitignored).

## Contributing

This repository is not currently accepting pull requests. If you have ideas, feedback, or want to discuss a change, open a [GitHub issue](https://github.com/coreydaley/obsidian-polyphon/issues) or an issue instead.
