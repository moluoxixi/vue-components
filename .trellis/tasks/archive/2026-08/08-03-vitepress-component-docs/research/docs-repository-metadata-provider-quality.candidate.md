# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

Documentation builds consume committed, validated inputs so local development and CI remain deterministic and do not depend on runtime network access.

---

## Forbidden Patterns

- Do not infer a repository metadata provider from file existence, environment variables, or fetch success.
- Do not merge or fall back between GitHub and local Git metadata snapshots.
- Do not persist author email addresses in browser-consumed metadata.
- Do not silently accept shallow Git history as complete component history.
- Do not use broad staging commands such as `git add --all` from metadata refresh automation.
- Do not make theme content decisions by checking a provider ID when a capability is available.

---

## Required Patterns

## Scenario: Strict repository metadata providers and snapshots

### 1. Scope / Trigger

- Trigger: adding or changing documentation repository metadata, its generator, its validation, its build integration, its theme content mapping, or its commit-hook automation.
- Scope: `docs/vitepress/.vitepress`, `docs/vitepress/scripts`, the documentation package scripts, the Element Plus documentation theme content integration, and the repository pre-commit command.

### 2. Signatures

The documentation config must select one registered provider explicitly:

```ts
type RepositoryMetadataProviderId = 'github' | 'local'

interface DocsSiteConfig {
  metadataProvider: RepositoryMetadataProviderId
  repository: {
    defaultBranch: string
    name: string
    owner: string
    url: string
  }
}
```

Each provider is registered with one identity, one snapshot file, a closed capability set, and a snapshot resolver:

```ts
interface RepositoryMetadataProvider {
  id: string
  platform: string
  snapshotFile: string
  capabilities: Readonly<RepositoryMetadataCapabilities>
  actions?: Readonly<RepositoryMetadataProviderActions>
  resolveSnapshot(
    snapshot: unknown,
    expectation: RepositoryMetadataExpectation,
  ): RepositoryMetadataPayload
}
```

The supported commands are:

```text
pnpm --filter @moluoxixi/docs sync-github-metadata
pnpm --filter @moluoxixi/docs sync-local-metadata
pnpm --filter @moluoxixi/docs sync-local-metadata:staged
pnpm --filter @moluoxixi/docs validate-github-metadata
pnpm --filter @moluoxixi/docs validate-local-metadata
pnpm --filter @moluoxixi/docs validate-selected-metadata
```

### 3. Contracts

- `github-metadata.json` and `local-metadata.json` are independent, committed snapshots.
- `metadataProvider: 'github'` loads and validates only `github-metadata.json` and exposes GitHub issue, profile, source, edit, and commit capabilities.
- `metadataProvider: 'local'` loads and validates only `local-metadata.json` and exposes local commits and contributors without GitHub profiles or repository actions.
- The build graph must not import the unselected snapshot.
- Runtime metadata resolution, Vite aliases, Vitest aliases, and selected-source validation must all derive the snapshot path from the same provider registry.
- The provider registry rejects duplicate IDs and unknown provider IDs before snapshot loading.
- A provider's action functions must agree with its `sourceLinks`, `editLinks`, and `issueActions` capabilities.
- The selected provider is normalized into `RepositoryMetadata` with provider identity and capabilities before the theme consumes it.
- Theme content maps capabilities to content and links. It does not infer platform behavior from provider IDs or manufacture unsupported links.
- Local history is collected from the configured default branch with component-scoped `git log --use-mailmap` queries, independent of the caller's currently checked-out branch.
- Local commits are sorted deterministically by date descending and SHA as the tie-breaker. Contributors use deterministic contribution-count and identity ordering.
- Local browser data contains only the closed, validated schema. Author email addresses and unrecognized fields are rejected.
- Snapshot replacement is a validated same-directory temporary write followed by rename. A failed refresh preserves the previous snapshot.
- `sync-local-metadata:staged` stages only `docs/vitepress/.vitepress/local-metadata.json`.
- The pre-commit snapshot records the configured default branch through its current commit. It cannot contain a default-branch commit being created because that commit object and SHA do not exist while the hook runs; the next refresh incorporates it.
- No environment key is required for local Git sync. GitHub sync may require `GITHUB_TOKEN` according to its API-rate-limit policy.

### 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Selected snapshot is missing or invalid | Fail validation and build; do not use the other snapshot |
| Unselected snapshot is missing or invalid | Selected-provider validation and build remain unaffected |
| `metadataProvider` is not a registered provider | Type/configuration error before snapshot loading; no implicit mode |
| A provider-required config field is missing or blank | Fail with a provider-specific configuration error before snapshot validation |
| A provider capability is enabled without all corresponding actions, or disabled with actions present | Fail provider registration |
| Repository is shallow | Fail local sync with instructions to fetch complete history |
| Configured local default branch ref is missing | Fail local sync instead of scanning an arbitrary `HEAD` |
| Component history cannot be parsed | Fail local sync and preserve the previous file |
| Snapshot contains email or an unknown nested field | Fail closed-schema validation |
| Temporary write or rename fails | Exit non-zero, remove only this invocation's temporary file, preserve the previous snapshot |
| Staged sync runs with unrelated working-tree changes | Refresh and stage only the local metadata snapshot |

### 5. Good/Base/Bad Cases

- Good: select `local`, run the staged sync from a complete repository, validate it, and commit the refreshed snapshot with unrelated files left unstaged unless the user staged them.
- Base: select `github` and build offline from the committed GitHub snapshot without reading local metadata.
- Bad: select whichever JSON exists, merge local commits with GitHub issues, or retry an invalid selected provider by loading the other file.

### 6. Tests Required

- Unit-test strict provider selection, including proof that an invalid or missing unselected snapshot cannot affect the selected provider.
- Unit-test provider registration, duplicate IDs, unknown IDs, required configuration fields, and capability/action consistency.
- Unit-test capability-to-content mapping for GitHub and local, including unsupported source/edit/issue controls and local contributor identity without profiles.
- Unit-test component path isolation, `.mailmap` identity use, deterministic ordering, empty history, Unicode commit subjects, and shallow-repository rejection.
- Unit-test closed-schema rejection of email and unknown nested fields.
- Unit-test validation-before-replacement and preservation of the previous snapshot after failure.
- Verify the staged command changes the index only for `local-metadata.json`.
- Run selected-provider validation, documentation type checking, theme type checking, focused tests, and a VitePress production build.

### 7. Wrong vs Correct

#### Wrong

```ts
const metadata = existsSync(githubPath)
  ? readSnapshot(githubPath)
  : readSnapshot(localPath)
```

This creates an implicit fallback and makes behavior depend on checkout contents.

#### Correct

```ts
const provider = repositoryMetadataProviders.get(docsSite.metadataProvider)
const snapshotPath = path.join(snapshotDirectory, provider.snapshotFile)

const metadata = repositoryMetadataProviders.resolve(
  docsSite.metadataProvider,
  validateSnapshotFile(snapshotPath),
  repositoryMetadataExpectation,
)
```

The selected provider is explicit, independently validated, and the only snapshot admitted to the build graph.

---

## Testing Requirements

Documentation infrastructure changes require focused unit tests for provider boundaries and capability mapping plus a production documentation build. Commit-hook automation must also be verified against the Git index so it cannot widen the user's staged set.

---

## Code Review Checklist

- Is the metadata provider explicit, registered, and exhaustive?
- Does the build import only the selected snapshot?
- Are provider-required config fields checked before snapshot parsing?
- Do provider capabilities and action functions agree?
- Does the theme gate content through capabilities rather than platform-specific checks?
- Are schemas strict and browser outputs free of private author fields?
- Are local history results deterministic and component-scoped?
- Does failure preserve the previous committed snapshot?
- Does automation stage only its owned output?
- Do documentation tests, type checks, and production build pass?
