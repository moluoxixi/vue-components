# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

Documentation builds consume generated API data and committed repository metadata. Provider integrations are infrastructure contracts: provider selection, snapshot identity, capabilities, API trust boundaries, and build ordering must remain deterministic.

---

## Forbidden Patterns

- Do not add an `auto` repository provider, read another provider's snapshot as fallback, or merge snapshots.
- Do not follow pagination URLs before checking both the configured API origin and normalized path prefix.
- Do not infer a GitLab account from a commit author's display name or email. Map the privacy-safe stable contributor ID to one reviewed exact username.
- Do not run network metadata synchronization in pre-commit hooks or required CI.
- Do not execute the native `.mts` scripts with Node versions below `22.6.0`.
- Do not remove `dependsOn: ["^build"]` from the Turbo docs build task; docs consumes workspace package output.
- Do not dynamically install Chromium and system packages in the browser CI job. Use a digest-pinned official Playwright image whose version matches `@playwright/test` in `pnpm-lock.yaml`.

---

## Required Patterns

### Scenario: Repository metadata provider integration

#### 1. Scope / Trigger

- Trigger: adding or changing a source-management provider, its metadata snapshot, sync/validation commands, URL actions, or CI/build wiring.
- Theme packages own platform-neutral types, registry policy, and URL action factories. `docs/vitepress` owns provider selection, repository identity, credentials, API clients, schemas, and snapshots.

#### 2. Signatures

```ts
createRepositoryMetadataProviderRegistry(
  providers: readonly RepositoryMetadataProvider[],
): RepositoryMetadataProviderRegistry

selectRepositoryMetadataConfiguration(
  providerId: string,
  repositories: Readonly<Record<string, DocsRepositoryConfiguration>>,
  expectations: Readonly<Record<string, RepositoryMetadataExpectation>>,
  providers: RepositoryMetadataProviderRegistry,
): DocsRepositoryMetadataSelection

resolveTrustedApiUrl(
  apiBaseUrl: string,
  pathOrUrl: string,
  providerName: string,
): string
```

Explicit commands follow this contract:

```text
pnpm -C docs/vitepress sync-<provider>-metadata
pnpm -C docs/vitepress validate-<provider>-metadata
pnpm -C docs/vitepress validate-repository-metadata
```

#### 3. Contracts

- Provider IDs are `github`, `local`, `gitlab`, `gitee`, and `yunxiao`; production selection is explicit and currently `github`.
- Every provider owns one snapshot file and one exact expectation. Selection resolves the provider, repository config, expectation, snapshot, and action input as a single unit.
- A provider capability is a maximum. Snapshot resolution may disable it but cannot enable a capability absent from the provider definition.
- Provider-specific environment keys are runtime-only: `GITHUB_TOKEN`, `GITLAB_TOKEN`, `GITEE_TOKEN`, and `YUNXIAO_TOKEN`. Never persist or print them.
- GitLab contributor profiles use `Record<gitlab:<sha256>, exactUsername>`. Resolve each mapping with `GET /users?username=<exactUsername>` and enrich only when exactly one response has the same username.
- GitLab synchronization requests `GET /projects/:id/repository/contributors?per_page=100`. Matching `(trimmed lowercase name, trimmed lowercase email)` records may canonicalize the contributor display name, but component contribution counts remain derived from commits scoped to each component path. Only a 404 or 405 permits the deterministic component-commit fallback; authentication, network, pagination, and payload errors must fail synchronization.
- GitLab contributor `login`, `avatarUrl`, and `profileUrl` fields are all-or-none. Unmapped, ambiguous, unavailable, or invalid profiles retain the stable contributor ID, commit count, display name, and initials fallback.
- A configured GitLab `webBaseUrl` must exactly equal the installation base derived from the repository URL and `projectPath`, including any relative installation path such as `/gitlab`.
- Persisted GitLab web URLs must stay under that exact installation base and contain no userinfo, query, or fragment. This prevents API-returned credential parameters from entering a public snapshot.
- `validate-repository-metadata` validates committed GitHub, GitLab, Gitee, and local snapshots offline. Yunxiao joins only after replacing its placeholder with a real tenant snapshot.
- Native `node scripts/*.mts` execution requires Node `>=22.6.0`.
- Turbo's `@moluoxixi/docs#build` must depend on `^build` so dependency packages finish before docs reads their `dist` output.
- Browser CI runs in the official Playwright container pinned by version and amd64 digest; the image version must exactly match the locked `@playwright/test` version.

#### 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Unknown provider ID | Throw before reading any snapshot |
| Missing repository config or expectation | Throw with the selected provider ID |
| Repository URL or default branch mismatch | Reject selection |
| Duplicate provider ID or invalid snapshot filename | Reject registry construction |
| Snapshot enables an unsupported capability | Reject resolution |
| GitLab Issue detail URL uses `/-/issues/:iid` or `/-/work_items/:iid` | Accept only when origin, project path, and IID exactly match the snapshot entry |
| GitLab commit detail URL differs by origin, project path, full SHA, query, or hash | Reject the snapshot |
| GitLab profile lookup returns zero, multiple, or a mismatched username | Keep the initials-only contributor fallback |
| GitLab repository contributors endpoint returns 404 or 405 | Fall back to component commit scanning |
| GitLab repository contributors endpoint returns 401/403, another HTTP failure, a network error, or malformed data | Fail synchronization and preserve the previous snapshot |
| GitLab contributor profile fields are partial, cross-instance, outside the installation path, or contain query/fragment/userinfo | Reject enrichment or the committed snapshot |
| GitLab `webBaseUrl` differs from the installation base derived from repository URL and `projectPath` | Fail before making API requests |
| Pagination changes API origin or leaves the configured API path | Reject the URL |
| Network `429` or bounded `5xx` | Retry only within the configured limit; redact tokens from errors |
| Yunxiao placeholder identity or all-zero SHA | Reject validation |
| Playwright container version differs from the lockfile | Reject the workflow contract test |

#### 5. Good / Base / Bad Cases

- Good: select `gitlab`, validate only `gitlab-metadata.json`, then construct GitLab actions from the same repository config.
- Base: select `local`; expose committed local history without any network token or sync call in CI.
- Bad: select `gitee` but load GitHub metadata, reuse GitHub URL templates, or silently fall back after validation failure.

#### 6. Tests Required

- Registry tests assert unique IDs, action/capability agreement, downgrade-only behavior, and strict provider isolation.
- URL tests assert platform routes, path/ref encoding, line anchors, issue queries, and unsupported actions.
- GitLab snapshot tests accept both server-returned Issue detail route families and reject cross-project or mismatched-IID URLs.
- GitLab snapshot tests bind every commit detail URL to the exact repository and full commit SHA, rejecting query and hash suffixes.
- GitLab contributor tests assert explicit stable-ID mappings, exact one-result username lookup, all fallback cases, profile-field atomicity, custom installation paths, and rejection of credential-bearing avatar URLs.
- GitLab repository contributor tests assert canonical display-name use, 404/405 commit-scan fallback, and hard failure for authentication and malformed-response cases.
- The reusable theme fixture renders a contributor whose profile and avatar live below a self-managed relative installation path, and its VitePress SSR build must succeed.
- API-client tests assert trusted pagination, loop detection, bounded retries, token redaction, and atomic replacement.
- Provider tests assert authentication headers, project identity, branch SHA, component filtering, pagination, normalization, and placeholder rejection.
- Root path-contract tests assert Node `>=22.6.0`, offline CI validators, and Turbo docs `^build` ordering.
- Release-workflow tests assert the Playwright image version, immutable digest, lockfile match, IPC option, and job timeout.
- Before commit, run lint, typecheck, tests, snapshot validators, docs build, release checks, and package verification in proportion to the change.

#### 7. Wrong vs Correct

##### Wrong

```ts
const snapshot = gitlabSnapshot ?? githubSnapshot
const next = await fetch(response.headers.get('link')!)
```

##### Correct

```ts
const selection = selectRepositoryMetadataConfiguration(
  providerId,
  repositories,
  expectations,
  repositoryMetadataProviders,
)
const next = resolveTrustedApiUrl(apiBaseUrl, nextLink, providerName)
```

---

## Testing Requirements

- Required CI validates committed snapshots without provider network access or external tokens.
- Network synchronization is an explicit maintainer operation. Commit the resulting snapshot only after reviewing its repository identity, paths, SHAs, URLs, and absence of credentials.
- A mocked provider test suite proves protocol behavior; a retained real-platform fixture is still required before claiming platform acceptance.

---

## Code Review Checklist

- Provider selection remains explicit and production stays on the intended provider.
- Snapshot, expectation, repository config, and URL actions all belong to the same provider.
- GitLab contributor mappings contain reviewed exact usernames only; snapshots never contain commit emails or credential-bearing profile/avatar URLs.
- Capability flags match both available actions and normalized output.
- Pagination cannot escape the configured API boundary and retry loops are bounded.
- Tokens are optional where anonymous reads are supported, runtime-only, and redacted from failures.
- Required CI remains offline; pre-commit refreshes only local metadata.
- Docs builds retain dependency ordering and the documented Node minimum matches `package.json`.
- Browser CI uses the lockfile-matched, digest-pinned Playwright image and keeps a bounded job timeout.
