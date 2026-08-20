# Design: GitLab contributor identity extraction

## Data Flow

`GitLab project API -> contributors endpoint + component commits -> normalized
GitLab contributors -> profile lookup for explicit mappings -> snapshot`.

The contributors endpoint is a repository-level source. Component contribution
counts remain based on the already fetched component commit lists so the existing
per-component contract stays stable. Endpoint records provide canonical display
name evidence for matching `(author name, author email)` identities.

## Fallback Contract

`404` and `405` mean the installation does not expose the endpoint and permit the
existing commit scan. `401`, `403`, malformed JSON, malformed records, and other
HTTP failures are errors because they indicate an unavailable or invalid API, not
an unsupported capability.

## Boundaries

- `gitlab-metadata.mts` owns response validation, fallback classification, and
  contributor normalization.
- `gitlab-metadata-types.ts` remains unchanged because the public snapshot schema
  does not need a new field. Its existing trusted-URL validator rejects query
  strings, fragments, and userinfo before profile/avatar values are persisted.
- Tests use mocked GitLab responses and assert request ordering, fallback, and
  failure semantics. No live token is required by CI.
