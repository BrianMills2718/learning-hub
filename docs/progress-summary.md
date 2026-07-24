# Progress Summary Contract

Each hosted environment writes one summary to browser local storage on the same origin as the
hub. The hub reads only this summary. It does not inspect event-log keys or app-specific state.

## Key

```
learning-hub:progress:<environment-id>:v1
```

`environment-id` is a stable catalog identifier such as `second-brain`, `learning-map`, or
`godel`.

## Payload

```json
{
  "schemaVersion": "1",
  "environmentId": "second-brain",
  "curriculumId": "second-brain-concept-ladder",
  "goalId": "a-model",
  "completedNodeIds": ["sb-kg"],
  "updatedAt": "2026-07-22T00:00:00.000Z"
}
```

## Rules

1. The environment writes a summary after initialization and after each learner-runtime update.
2. `completedNodeIds` contains only explicitly passed nodes from that environment's runtime.
3. The hub treats an unknown schema version or malformed payload as absent progress.
4. The summary is a display and aggregation boundary, not authoritative learner evidence.
5. Cross-environment accomplishments must map explicit environment outcomes; they must not infer
   equivalence from lesson titles, concept labels, or counts.
