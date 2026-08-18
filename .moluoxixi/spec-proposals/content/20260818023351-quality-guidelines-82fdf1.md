# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

Documentation builds consume committed, validated inputs so local development and CI remain deterministic and do not depend on runtime network access.

---

## Forbidden Patterns

- Do not infer a repository metadata source from file existence, environment variables, or fetch success.
- Do not merge or fall back between GitHub and local Git metadata snapshots.
- Do not persist author email addresses in browser-consumed metadata.
- Do not silently accept shallow Git history as complete component history.
- Do not use broad staging commands such as `git add --all` from metadata refresh automation.

---

## Required Patterns

## Scenario: Strict repository metadata snapshots

### 1. Scope / Trigger

- Trigger: adding or changing documentation repository metadata, its generator, its validation, its build integration, or its commit-hook automation.
- Scope: `docs/vitepress/.vitepress`, `docs/vitepress/scripts`, the documentation package scripts, and the repository pre-commit command.

### 2. Signatures

The documentation config must select one source explicitly:

```ts
type RepositoryMetadataSource = 'github' | 'git-local'

interface DocsSiteConfig {
  metadataSource: RepositoryMetadataSource
}
```

The supported commands are:

```text
pnpm --filter @moluoxixi/docs sync-github-metadata
pnpm --filter @moluoxixi/docs sync-git-local-metadata
pnpm --filter @moluoxixi/docs sync-git-local-metadata:staged
pnpm --filter @moluoxixi/docs validate-github-metadata
pnpm --filter @moluoxixi/docs validate-git-local-metadata
pnpm --filter @moluoxixi/docs validate-selected-metadata
```

### 3. Contracts

- `github-metadata.json` and `git-local-metadata.json` are independent, committed snapshots.
- `metadataSource: 'github'` loads and validates only `github-metadata.json`.
- `metadataSource: 'git-local'` loads and validates only `git-local-metadata.json`.
- The build graph must not import the unselected snapshot.
- Local history is collected from the configured default branch with component-scoped `git log --use-mailmap` queries, independent of the caller's currently checked-out branch.
- Local commits are sorted deterministically by date descending and SHA as the tie-breaker. Contributors use deterministic contribution-count and identity ordering.
- Local browser data contains only the closed, validated schema. Author email addresses and unrecognized fields are rejected.
- Snapshot replacement is a validated same-directory temporary write followed by rename. A failed refresh preserves the previous snapshot.
- `sync-git-local-metadata:staged` stages only `docs/vitepress/.vitepress/git-local-metadata.json`.
- The pre-commit snapshot records the configured default branch through its current commit. It cannot contain a default-branch commit being created because that commit object and SHA do not exist while the hook runs; the next refresh incorporates it.
- No environment key is required for local Git sync. GitHub sync may require `GITHUB_TOKEN` according to its API-rate-limit policy.

### 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Selected snapshot is missing or invalid | Fail validation and build; do not use the other snapshot |
| Unselected snapshot is missing or invalid | Selected-source validation and build remain unaffected |
| `metadataSource` is not `github` or `git-local` | Type/configuration error; no implicit mode |
| Repository is shallow | Fail local sync with instructions to fetch complete history |
| Configured local default branch ref is missing | Fail local sync instead of scanning an arbitrary `HEAD` |
| Component history cannot be parsed | Fail local sync and preserve the previous file |
| Snapshot contains email or an unknown nested field | Fail closed-schema validation |
| Temporary write or rename fails | Exit non-zero, remove only this invocation's temporary file, preserve the previous snapshot |
| Staged sync runs with unrelated working-tree changes | Refresh and stage only the local metadata snapshot |

### 5. Good/Base/Bad Cases

- Good: select `git-local`, run the staged sync from a complete repository, validate it, and commit the refreshed snapshot with unrelated files left unstaged unless the user staged them.
- Base: select `github` and build offline from the committed GitHub snapshot without reading local metadata.
- Bad: select whichever JSON exists, merge local commits with GitHub issues, or retry an invalid selected source by loading the other file.

### 6. Tests Required

- Unit-test strict source selection, including proof that an invalid or missing unselected snapshot cannot affect the selected source.
- Unit-test component path isolation, `.mailmap` identity use, deterministic ordering, empty history, Unicode commit subjects, and shallow-repository rejection.
- Unit-test closed-schema rejection of email and unknown nested fields.
- Unit-test validation-before-replacement and preservation of the previous snapshot after failure.
- Verify the staged command changes the index only for `git-local-metadata.json`.
- Run selected-source validation, documentation type checking, theme type checking, focused tests, and a VitePress production build.

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
const snapshotPath = docsSite.metadataSource === 'github'
  ? githubPath
  : localPath

const metadata = validateSelectedSnapshot(docsSite.metadataSource, snapshotPath)
```

The selected source is explicit, independently validated, and the only snapshot admitted to the build graph.

---

## Testing Requirements

Documentation infrastructure changes require focused unit tests for their boundary contracts plus a production documentation build. Commit-hook automation must also be verified against the Git index so it cannot widen the user's staged set.

---

## Code Review Checklist

- Is the metadata source explicit and exhaustive?
- Does the build import only the selected snapshot?
- Are schemas strict and browser outputs free of private author fields?
- Are local history results deterministic and component-scoped?
- Does failure preserve the previous committed snapshot?
- Does automation stage only its owned output?
- Do documentation tests, type checks, and production build pass?
