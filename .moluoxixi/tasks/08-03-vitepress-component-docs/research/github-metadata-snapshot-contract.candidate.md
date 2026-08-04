# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

<!--
Document your project's quality standards here.

Questions to answer:
- What patterns are forbidden?
- What linting rules do you enforce?
- What are your testing requirements?
- What code review standards apply?
-->

(To be filled by the team)

---

## Scenario: Deterministic external metadata for documentation builds

### 1. Scope / Trigger

- Apply this contract when documentation displays GitHub issues, contributors, or commit history.
- Development and production builds consume a committed snapshot and do not call GitHub.
- Refreshing external data is an explicit command with network access and optional authentication.

### 2. Signatures

```ts
createGithubMetadata(options: {
  owner: string
  repository: string
  defaultBranch: string
  components: Array<{ name: string, path: string }>
  issueTitlePrefix: (componentName: string) => string
  excludeBotsFromContributors: boolean
  userAgent: string
  token?: string
}): Promise<GithubMetadataSnapshot>

assertGithubMetadataSnapshot(
  value: unknown,
  expected: {
    owner: string
    repository: string
    defaultBranch: string
    components: Array<{ name: string, path: string }>
  },
): asserts value is GithubMetadataSnapshot
```

Commands:

```text
pnpm --filter @moluoxixi/docs sync-github-metadata
pnpm --filter @moluoxixi/docs validate-github-metadata
```

### 3. Contracts

- Resolve the configured branch once and pin every component commit query to that full 40-character head SHA.
- Follow GitHub REST pagination until no `rel="next"` link remains.
- Exclude pull requests from issue counts even though the issues endpoint returns both issues and pull requests.
- Attribute issue counts by the configured component-title prefix and commit history by the configured component source path.
- Derive a component's contributors only from that component's commit set. Contributor and changelog views must share the same commit projection.
- Preserve author name, avatar/profile URLs, commit URL, message, SHA, and a valid date. When the Git author date is null, fall back to the Git committer date.
- Validate repository identity, configured branch, component key/path coverage, profile references, counts, SHA formats, URLs, and dates before the snapshot replaces the previous file.
- Write to a sibling temporary file and rename it only after validation succeeds. Any request, rate-limit, parsing, or validation failure must leave the last valid snapshot untouched.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| GitHub returns a paginated response | Follow only `rel="next"` and merge every page once |
| Issues response contains a pull request | Exclude it from repository and component issue counts |
| Component path has no commits | Preserve an empty component commit/contributor projection |
| GitHub user association is null | Keep the commit using the embedded Git author/committer identity |
| Git author date is null | Use the committer date |
| Response shape, SHA, date, profile, or component coverage is invalid | Fail sync before rename and preserve the previous snapshot |
| Snapshot branch differs from site configuration | Fail predev/prebuild validation |
| GitHub returns 429, retryable 5xx, or 403 with `Retry-After` | Retry with a bounded delay, then fail without replacing the snapshot |

### 5. Good/Base/Bad Cases

- Good: sync resolves `main` to one SHA, fetches all pages, validates all configured component paths, and atomically replaces the committed snapshot.
- Base: normal `dev` and `build` validate and render the existing snapshot without network access.
- Bad: build-time Vue code calls GitHub and displays zero when the network or rate limit fails.
- Bad: a successful HTTP 200 response is written before validating required fields.
- Bad: contributor lists are computed repository-wide and reused on every component page.

### 6. Tests Required

- Pagination: assert the second issue and commit pages are fetched exactly once.
- Fixed head: assert every commit query uses the resolved full SHA rather than a moving branch name.
- Attribution: assert pull requests are excluded, issues use exact configured prefixes, and commit queries use component paths.
- Contributor policy: assert bots are excluded when configured and null GitHub authors do not drop commits.
- Date fallback: assert a null Git author date uses the committer date.
- Runtime validation: assert missing components, mismatched branches, invalid dates, duplicate SHAs, and missing profiles fail.
- Replacement safety: assert invalid generated data is rejected before the filesystem rename step.
- Offline build: assert predev/prebuild validate the snapshot and require no GitHub token or network access.

### 7. Wrong vs Correct

#### Wrong

```ts
const snapshot = await createGithubMetadata(options)
writeFileSync(outputPath, JSON.stringify(snapshot))
```

#### Correct

```ts
const snapshot = await createGithubMetadata(options)
assertGithubMetadataSnapshot(snapshot, expectedConfiguration)
writeFileSync(temporaryPath, JSON.stringify(snapshot))
renameSync(temporaryPath, outputPath)
```

---

## Forbidden Patterns

<!-- Patterns that should never be used and why -->

(To be filled by the team)

---

## Required Patterns

<!-- Patterns that must always be used -->

(To be filled by the team)

---

## Testing Requirements

<!-- What level of testing is expected -->

(To be filled by the team)

---

## Code Review Checklist

<!-- What reviewers should check -->

(To be filled by the team)
