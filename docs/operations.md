# Mac Mini Operations

The Mac mini runs the Learning Hub Node service on port 8780. Tailscale Funnel terminates public
HTTPS and forwards requests to this listener; the service binds only to loopback, so it is
reachable through the public proxy but not directly over the network.

The service serves the static site and its same-origin `/api` routes. Persistent shared-profile
and creation-request state is SQLite at `/Users/b/Library/Application Support/learning-hub/`,
outside the rotated static site directory.

## Install Or Replace The Service

```bash
./scripts/install-mac-mini-service.sh
```

This installs `com.brianmills.learning-hub` in the Mac user's `LaunchAgents` directory and
replaces the historical `com.brianmills.learning-environment-pilot` service if it exists.

## Deploy A Site Update

```bash
./scripts/deploy-mac-mini.sh
```

The script builds all five applications, copies a complete staged site, then swaps the served
directory. The prior site remains at `/Users/b/Sites/learning-environment-pilot-previous` for
rollback or inspection.

## Verify

```bash
curl -fsS http://127.0.0.1:8780/
/Applications/Tailscale.app/Contents/MacOS/Tailscale funnel status
```

The public URL is reported by `tailscale funnel status`. Do not place provider credentials or
learner data in the static directory. The current public API has no identity or ownership model,
so do not place private information in a shared-name profile.
