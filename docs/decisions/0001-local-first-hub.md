# ADR 0001: Local-First Hub And Explicit Progress Summaries

**Status:** Accepted

## Context

The five existing applications are static sites with separate learner runtimes. The first hub
needs to show real progress and collect environment-creation requirements without exposing
provider credentials or adding a public account system before its requirements are understood.

## Decision

The hub is a static application. It stores the learner alias and creation briefs in browser local
storage. Each environment writes one small, versioned progress summary on the shared origin. The
hub aggregates only those summaries.

Creation produces a draft brief, not a public curriculum. A future generation service must accept
that brief through an authenticated queue, run the existing curriculum gates, and require an
explicit publication decision.

## Consequences

- The initial workspace is usable without a backend, password, provider key, or database.
- Progress and drafts remain in one browser profile and are not an account.
- A username alone is insufficient for shared or cross-device identity. The next identity boundary
  should use passkeys or another passwordless credential, not an unauthenticated name claim.
- The summary contract protects the hub from app-internal storage changes, but each environment
  must deliberately maintain its publisher.
