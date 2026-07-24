# Learning Hub

The shared workspace for hosted learning environments. It provides a catalog, a browser-local
learner alias, explicit cross-environment accomplishment readouts, and structured creation
briefs for new environments.

## What Exists

- The catalog links to Second Brain, Learning Map, Godel, Category Theory, and Claude Code.
- A local alias labels the current browser's workspace.
- Each environment publishes a minimal, versioned progress summary on the shared browser origin.
- The hub aggregates those summaries into explicit cross-environment accomplishments.
- The creation flow stores a draft brief locally and exports it as JSON for generation and review.

## What Does Not Exist Yet

- A local alias is not an account, cannot prevent name collisions, and does not synchronize across
  browsers or devices.
- Drafts are not generated curricula and are never published automatically.
- The current accomplishment is deliberately small: it reads whether each existing environment
  has recorded actual progress. Future accomplishments need authored mappings, not title matching.
- There is no server-side API, database, provider credential, or public submission queue.

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
