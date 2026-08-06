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

## Scenario: Browser-compiled documentation demos

### 1. Scope / Trigger

- Apply this contract to Markdown fences whose Vue SFC source is compiled in the browser rather than by the host Vite build.
- Every demo is a self-contained module. Runtime components must be imported explicitly even when the documentation host uses automatic imports.
- The static regression check and runtime compiler must consume the same source roots, locale document list, and module allowlist.

### 2. Signatures

```ts
extractDemoSources(markdown: string): Array<{
  source: string
  fenceInfo: string
}>

validateDemoSource(options: {
  source: string
  supportedModules: ReadonlySet<string>
  exportedNamesByModule: ReadonlyMap<string, ReadonlySet<string>>
}): void
```

### 3. Contracts

- Recognize attributed backtick and tilde Vue fences; do not require the fence info string to equal `vue` exactly.
- Parse imports with the Vue/TypeScript compiler AST. A same-named local variable is not proof that a component was imported.
- Normalize PascalCase and kebab-case template tags before matching them to local component bindings.
- Reject imports outside the browser compiler's explicit module allowlist.
- Validate named imports against the module's real public exports. A valid module path with a misspelled export must fail before the browser opens.
- Scan every configured locale source document through the centralized documentation-site configuration.
- Unknown modules, relative files, and unresolved custom components must fail with a source path and actionable diagnostic.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Vue fence uses backticks/tilde plus attributes | Extract and validate the SFC |
| Template uses `<request-select-v2>` | Normalize and require the corresponding local/import binding |
| Script declares `const RequestSelectV2 = {}` | Do not treat it as a package import |
| Import module is not in the runtime allowlist | Fail the regression test with the module name |
| Named import does not exist | Fail before VitePress build/browser smoke |
| Locale-specific source contains a demo | Apply the same checks as the default locale |
| Demo has only native HTML tags | Pass without component imports |

### 5. Good/Base/Bad Cases

- Good: the SFC imports every runtime component from an allowed module and each named export exists.
- Base: a demo containing only native elements and locally declared lowercase variables passes.
- Bad: host automatic imports make the documentation shell render while the browser SFC contains unresolved custom elements.
- Bad: a regex validates only PascalCase tags or only an exact, attribute-free Vue fence.
- Bad: a test checks compiler bindings without proving they came from an import declaration.

### 6. Tests Required

- Fence parsing: cover backticks, tildes, and attributed fence info strings.
- Tag normalization: cover PascalCase and kebab-case custom components.
- Import provenance: assert a same-named local declaration cannot satisfy an explicit-import requirement.
- Runtime parity: reject modules outside the browser compiler allowlist.
- Export parity: reject a missing named export from an otherwise allowed module.
- Locale coverage: assert every configured documentation locale source is scanned.
- Repository smoke: compile and mount representative demos and assert no unresolved-component console warnings.

### 7. Wrong vs Correct

#### Wrong

```ts
const tags = source.match(/<([A-Z][A-Za-z0-9]*)/g) ?? []
for (const tag of tags)
  expect(compiled.bindings[tag]).toBeTruthy()
```

#### Correct

```ts
const descriptor = parse(source).descriptor
const imports = collectImportDeclarations(descriptor.scriptSetup?.content ?? '')
assertSupportedModules(imports, supportedModules)
assertNamedExports(imports, exportedNamesByModule)
assertTemplateComponentsResolve(descriptor.template?.content ?? '', imports)
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
