# Yunxiao Codeup repository provider

## Goal

Implement a production-grade Yunxiao Codeup repository provider with honest capability limits and verify it against a real authenticated tenant repository, while keeping production on GitHub.

## Requirements

- Add independent Yunxiao configuration, actions, schema, snapshot, normalizer, OpenAPI collector, sync/validation commands, and deterministic tests.
- Support central and organization-region API forms through explicit configuration; use canonical repository/commit web URLs returned by the API where available.
- Synchronize default branch HEAD, component-scoped commits, and contributor counts aggregated from commits when no contributor API exists.
- Keep `issues` and `issueActions` false. Do not map Projex work items or Codeup change requests to repository Issues.
- Enable source-line and edit actions only after exact routes/anchors are proven in the real tenant; otherwise leave those capabilities disabled.
- Use a runtime PAT (`X-Yunxiao-Token` or documented bearer form), redact it, paginate/retry safely, validate strictly, and write atomically.
- Create and retain a test-only private/internal Codeup repository through the authenticated browser and validate every enabled capability.
- Keep required CI offline and do not add Yunxiao Flow deployment.

## Acceptance Criteria

- [x] The registry contains `yunxiao` with its own snapshot and no fallback; production remains `github`.
- [x] Central/region API configuration, organization, and repository identifiers are explicit and validated.
- [x] Commit history and aggregated contributor counts are accurate for a real repository.
- [x] Repository Issues and issue actions are absent in metadata and UI.
- [x] Source/edit/line capabilities are enabled only with recorded real-route evidence; unsupported routes remain hidden.
- [x] Client/sync tests cover PAT headers/redaction, API variants, pagination, retry/rate limits, filtering, canonical URLs, aggregation, and atomic writes.
- [x] A real authenticated Codeup project proves all enabled links and live metadata synchronization.
- [ ] Documentation, focused/full checks, commit/push, and GitHub Actions succeed.

## Out of Scope

- Anonymous public Codeup support without platform evidence.
- Mapping Projex work items or change requests to Issues.
- Switching production or adding Yunxiao Flow deployment.

