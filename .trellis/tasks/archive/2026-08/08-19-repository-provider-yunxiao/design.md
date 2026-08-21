# Design: Yunxiao Codeup repository provider

## Configuration and Snapshot

Compose the shared contract with explicit `apiMode` (`central` or `region`), `apiBaseUrl`, organization ID, repository ID/path, and expected default branch. Use a versioned `yunxiao-metadata.json` containing canonical repository identity/web URL, default branch/HEAD, verified link capabilities, and per-component commits/contributors.

## API and Capability Policy

Use Codeup repository, files/tree, branches, and commits OpenAPI endpoints with an injected fetch and runtime PAT. Central URLs include the organization path; region URLs use the tenant base. Prefer canonical `webUrl` values returned by repository and commit responses.

No contributors endpoint is assumed: aggregate stable contributor identities/counts from component-scoped commits. Contributor profiles remain disabled unless a deterministic member mapping is proven. Issues and issue actions are always disabled because Codeup does not expose repository Issues.

Source/blob/edit/line web routes are not guessed. The real tenant validation records exact routes and anchors; only proven actions become capabilities. This may produce a provider that initially exposes commits/contributors and canonical repository/commit links while hiding unverified file/edit actions.

## Real Validation

Use the authenticated Yunxiao tenant to create a private/internal test repository, add CopyText content and multiple commits, inspect exact source/edit/line/commit routes, and run the collector with a minimum-scope PAT. Retain the repository and never persist the PAT.

