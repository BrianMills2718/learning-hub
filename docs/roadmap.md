# Roadmap

## Slice 1: Local Shared Workspace

**Status:** Hosted and verified on the Mac mini public origin.

The hub catalogs the five existing applications, stores a browser-local alias, reads explicit
progress summaries, shows one cross-environment accomplishment, and creates exportable draft
briefs. The static deployment script stages and swaps the full site atomically.

**Done:** Browser verification confirmed the hub and all five application routes on the hosted
origin. Cross-environment progress remains browser-local by design for this slice.

## Slice 2: Authenticated Draft Intake

Replace browser-local draft handoff with an authenticated server-side queue. A submitted brief
must retain requester identity, source material, generation status, gate reports, and an explicit
publication decision. It must not expose provider credentials to the browser.

## Slice 3: Passwordless Identity And Sync

Replace the local alias with passkeys or an equivalent passwordless credential. Sync learner
evidence and drafts through a server contract with conflict, deletion, and recovery semantics.

## Slice 4: Authored Cross-Environment Achievements

Define named achievements that map exact completed outcomes across environments. Add clear
evidence requirements, displayable explanations, and tests for every mapping.
