# ADR 0001: Public Shared Profiles And Explicit Progress Summaries

**Status:** Accepted

## Context

The five existing applications are static sites with separate learner runtimes. The hub needs to
show real progress, let visitors choose a public name, and persist requests for generated learning
environments without exposing provider credentials or adding a login system.

## Decision

The hub is a same-origin static application plus a loopback-only Node service on the Mac mini.
The browser retains only the currently selected username; profiles and creation requests persist
in the service's SQLite database. Each environment writes one small, versioned progress summary
on the shared origin. The hub aggregates only those summaries.

An existing name displays its shared status. Anyone may use that name and see or add shared
requests. Creation records whether current web research is required before compilation. A future
worker must run the existing curriculum gates and preserve source snapshots before it can mark a
request generated or publish a learning environment.

## Consequences

- The selected username is not an account or authorization boundary. Shared-name collisions are
  intentional, so the service must not store private learner material or authorize privileged work
  from a username alone.
- Browser-local progress remains local until individual environments publish it to the service.
- The service owns persistent profile and request state, but it does not hold provider credentials
  in the static directory or expose them to a browser.
- The summary contract protects the hub from app-internal storage changes, but each environment
  must deliberately maintain its publisher.
