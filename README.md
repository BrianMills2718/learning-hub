# Learning Hub

The shared workspace for hosted learning environments. It provides a catalog, public shared
username profiles, explicit cross-environment accomplishment readouts, and persistent creation
requests for new environments.

## What Exists

- The catalog links to Second Brain, Learning Map, Godel, Category Theory, and Claude Code.
- A public username opens a shared profile. When a name already exists, the visitor sees its
  status and can use the shared profile or choose another name. There is intentionally no login.
- Each environment publishes a minimal, versioned progress summary on the shared browser origin.
- The hub aggregates those summaries into explicit cross-environment accomplishments.
- The creation flow persists a structured request on the Mac mini, including whether the compiler
  must obtain current web sources before generation.

## What Does Not Exist Yet

- A shared username has no ownership boundary. Anyone using the same name can see and add to that
  shared profile; this is deliberate and unsuitable for private material.
- Requests enter a durable queue, but the curriculum compiler worker and automatic publication
  are not wired yet.
- The current accomplishment is deliberately small: it reads whether each existing environment
  has recorded actual progress. Future accomplishments need authored mappings, not title matching.
- The service deliberately exposes no provider credential to browsers. The worker will use
  `llm_client` and OpenRouter DeepSeek V4 Flash from the server environment.

## Contracts

- [Progress Summary Contract](docs/progress-summary.md)
- [ADR 0001: Local-First Hub](docs/decisions/0001-local-first-hub.md)
- [Roadmap](docs/roadmap.md)
- [Concern Register](docs/concerns.md)
- [Mac Mini Operations](docs/operations.md)

## Verification

```bash
npm run check
npm run install:mac-mini
npm run deploy:mac-mini
```

The deployment script runs each environment's full `npm run check`, stages all static files on the
Mac mini, and swaps the host directory only after the copy succeeds.
