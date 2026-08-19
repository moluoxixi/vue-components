# Design: GitLab repository provider

## Package Boundary

Move the normalized repository metadata types, provider registry, capability filtering, and reusable web action factories into a focused theme-package repository module exported from the package root. Docs-specific snapshot assertions and normalizers compose those public contracts.

Provider capabilities define a maximum. An optional snapshot resolver may only downgrade capabilities. The registry validates the downgrade, applies the effective policy to data, and exposes effective capabilities to generic UI consumers.

## Configuration and Snapshot

GitLab configuration contains `webBaseUrl`, `apiBaseUrl`, full `projectPath`, and expected default branch. The project API identifier is `encodeURIComponent(projectPath)`.

Use a versioned `gitlab-metadata.json` with repository `{ projectPath, webUrl, defaultBranch, headSha, issuesEnabled }` and per-component `{ path, openIssueCount?, commits, contributors }`. Validation requires exact project/branch/component identity and valid full SHAs, dates, counts, and canonical URLs.

## API and Links

The injected-fetch REST v4 client reads project metadata, path-scoped commits, repository contributors, and open project Issues. It follows `x-next-page`/`Link`, honors `Retry-After`, retries bounded `429/5xx`, and sends `PRIVATE-TOKEN` only when configured.

GitLab web actions use canonical `webUrl` plus `/-/tree`, `/-/blob`, `/-/edit`, `/-/commit`, and `/-/issues` routes. Refs/paths are encoded by segment; search/title values use query encoding. Contributor identities remain name/email-based unless GitLab returns a deterministic user mapping.

## Real Validation and Rollback

Create a public test-only project on JiHu GitLab under the authenticated namespace, add CopyText source/docs, at least two commits, and one `[CopyText]` Issue. Validate the collector and all enabled web actions. The project is retained. Production selection stays GitHub, so GitLab registration/snapshot can be reverted independently.

