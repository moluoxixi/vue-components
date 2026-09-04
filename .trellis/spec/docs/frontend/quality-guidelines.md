# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

Documentation builds consume generated API data and an ignored snapshot for the explicitly selected repository provider. Provider integrations are infrastructure contracts: provider selection, snapshot identity, capabilities, API trust boundaries, generated-path ownership, and build ordering must remain deterministic.

---

## Forbidden Patterns

- Do not add an `auto` repository provider, read another provider's snapshot as fallback, or merge snapshots.
- Do not follow pagination URLs before checking both the configured API origin and normalized path prefix.
- Do not infer a GitLab account from a commit author's display name or email. Map the privacy-safe stable contributor ID to one reviewed exact username.
- Do not infer a Yunxiao account from a commit author's display name or email. Map the privacy-safe commit identity to one reviewed exact Codeup username.
- Do not import Node-only modules such as `node:crypto` from `.vitepress` snapshot validators. These validators are bundled for both SSR and the browser.
- Do not run metadata synchronization in pre-commit hooks, commit generated snapshots, or contact non-selected providers during required CI. The production docs build may synchronize its explicitly selected GitHub provider with the workflow token.
- Do not run the packaged `element-plus-docs` Node lifecycle below Node `22.6.0`.
- Do not remove `dependsOn: ["^build"]` from the Turbo docs build task; docs consumes workspace package output.
- Do not dynamically install Chromium and system packages in the browser CI job. Use a digest-pinned official Playwright image whose version matches `@playwright/test` in `pnpm-lock.yaml`.

---

## Required Patterns

### Scenario: Repository metadata provider integration

#### 1. Scope / Trigger

- Trigger: adding or changing a source-management provider, its metadata snapshot, sync/validation commands, URL actions, or CI/build wiring.
- The theme package owns platform-neutral types, registry policy, URL actions, provider schemas/collectors, generated snapshot validation, and the isolated Node/CLI lifecycle. `docs/vitepress` owns only project catalog/configuration, repository identity fields that cannot be derived, and runtime credential environment variables.

#### 2. Signatures

```ts
createRepositoryMetadataProviderRegistry(
  providers: readonly RepositoryMetadataProvider[],
): RepositoryMetadataProviderRegistry

resolveElementPlusDocsProjectRepository(
  project: ElementPlusDocsProjectInput,
  providerOverride?: string,
): ElementPlusDocsResolvedRepository

resolveTrustedApiUrl(
  apiBaseUrl: string,
  pathOrUrl: string,
  providerName: string,
): string
```

Supported lifecycle commands follow this contract:

```text
VITE_DOCS_REPOSITORY_METADATA_PROVIDER=<provider-id> element-plus-docs dev
element-plus-docs prepare
element-plus-docs build
element-plus-docs preview [--config <path>] [--port <port>]
```

#### 3. Contracts

- Provider IDs are `github`, `local`, `gitlab`, `gitee`, and `yunxiao`; production selection is explicit and currently `github`.
- Consumers configure one `element-plus-docs.config.ts` through `defineElementPlusDocsProject`; they do not copy repository/provider/metadata scripts or schemas.
- GitHub/Gitee derive owner and repository from the public HTTPS repository URL. GitLab derives the project path and installation/API roots, including relative installation paths. Local derives the Git root, remote URL, and default branch where available. Yunxiao additionally requires the non-derivable `repositoryId`.
- Any CI job that executes a local-provider metadata consumer must checkout complete Git history (`fetch-depth: 0`). The local provider intentionally rejects shallow clones rather than publishing incomplete commit and contributor history; jobs that do not read local metadata may retain shallow checkout.
- A private workspace docs site must not rely on a package bin shim whose target is created only by a later workspace build. Its `predev` / `prebuild` / `preprepare:docs` lifecycle builds the theme first, then invokes the emitted CLI file directly. Published consumers still use the package's normal `element-plus-docs` bin.
- Component catalogs use `defineComponentPackage` profiles. A profile owns package name, API entry, component/docs/repository source functions, browser loader, and styles; normal component items contain display fields plus an optional profile ID instead of repeating paths.
- The project config also owns `documentation.componentsRoute`, `documentation.defaultLocale`, and each locale's `sourceDirectory` / `sourceDoc`; source-link and route generation code must consume this contract instead of a second site-local locale table.
- Project Markdown uses only `elementPlusDocsProjectMarkdownPlugin`. It composes Demo parsing, provider-owned source-line actions, and external Playground projection. Do not expose or restore consumer `resolveSourceHref` / `resolveExternalProjectSource` callbacks.
- Package profiles that require root-import minimization provide `loadPlaygroundManifest`. The CLI loads manifests only after package build, validates them, and writes `.generated/markdown/playground-manifests.json`; VitePress never imports a not-yet-built generated manifest during config load.
- `loadPlaygroundManifest` is the current lifecycle contract, not a compatibility hook. It may return the manifest or the ESM namespace produced by `import()`, and lifecycle normalization validates the package identity and entries before committing the snapshot.
- The theme root and `./repository` entry remain browser-safe. Node collectors and filesystem/Git operations are reachable only through `./repository/node` and the packaged CLI.
- Only the selected provider is loaded, configured, synchronized, and validated. Unselected providers require no configuration, token, or network access.
- `VITE_DOCS_REPOSITORY_METADATA_PROVIDER` is an optional startup/build-time override for local debugging. Missing or blank values select `repository.provider` from the project config; supported configured values select exactly one provider; unknown or unconfigured values fail before snapshot loading. It is not an in-browser runtime switch.
- Every provider owns one generated snapshot file under `docs/vitepress/.generated/repository/` and one exact expectation. Selection resolves the provider, repository config, expectation, snapshot, and action input as a single unit.
- `docs/vitepress/.generated/` is the only project-owned generated root. Its `content/`, `api/`, `repository/`, `markdown/`, and `types/` children are ignored and must be recreated by supported docs lifecycle commands.
- Locale authoring Markdown lives only in committed, explicit source directories such as `zh/` and `en/`. The CLI rebuilds `.generated/content/<sourceDirectory>` before any route generator runs, injects the source file's Git timestamp into projected Markdown, and copies `public/` into the runtime content root.
- Locale `sourceDirectory` values must not overlap each other or the reserved `public` projection. The dev watcher must register the optional `public/` source even when it does not exist at startup so later asset creation is projected without restarting the server.
- `generatedDirectory` must be a non-root directory relative to the docs root, and its `content/` subtree must not contain or be contained by any authoring/public source. Validate this in project configuration for early feedback and again against canonical real paths immediately before staging replacement. Resolve the nearest existing ancestor when a target does not exist so Windows junctions and directory aliases cannot bypass the check; the public Node synchronizer must remain non-destructive even when called with a hand-built project object.
- The public Node staging API must independently reject absolute or non-normalized `sourceDirectory` values, overlapping projections, source events that resolve outside their source root, and destinations that resolve outside runtime content. Revalidate immediately before every destructive replacement or watcher mutation. Use a system-created unique temporary directory; retry atomic rename only for bounded transient filesystem-lock errors, never for an existing/conflicting destination.
- VitePress consumes `.generated/content` through `srcDir`. Components and utilities are physical generated Markdown under each locale tree so built-in local search can index them; they must never be written back into the authoring directories or committed.
- When a locale's `sourceDirectory` differs from its public `pathPrefix`, use `createElementPlusDocsContentRewrites(project)`. For VitePress 1.6.4 the supported root-locale rule is `zh/:path* -> :path*`; regex-shaped `zh/(.*) -> $1` is invalid.
- `pnpm -C docs/vitepress dev`, `pnpm -C docs/vitepress build`, `pnpm -C docs/vitepress preview`, root `build:docs`, and Pages builds run the preparation pipeline before VitePress. Direct `vitepress build` or `vitepress preview` bypasses this contract and is unsupported.
- `element-plus-docs preview` prepares the selected provider and generated content before serving the existing VitePress output. It does not rebuild that output. Under VitePress 1.6.4 the preview server contract is limited to the docs root and optional port; an occupied port is a hard startup failure rather than an automatic fallback.
- The preparation pipeline emits stable `[docs:prepare] START|OK|FAIL` records with step names and durations. Metadata steps include the selected provider and generated directory; failures preserve child output, report the exit code, and stop the pipeline without printing credentials.
- Preparation is strictly sequential. A failed command, manifest load, provider synchronization, or selected-snapshot validation releases the lock, prevents all later steps, and prevents VitePress `dev` / `build` from starting.
- Preparation is not a global filesystem transaction across generated routes, API contracts, manifest snapshots, and provider snapshots. Earlier successful steps may remain after a later failure; the next supported prepare rebuilds them. Each JSON snapshot writer still validates in memory and replaces its own file atomically.
- After validation, the CLI injects the selected snapshot path and resolved default branch into the same process before starting VitePress. `defineElementPlusDocs` installs the virtual snapshot resolver; consumer `.vitepress/config.ts` must not reproduce a provider-specific alias.
- CLI path injection distinguishes `ELEMENT_PLUS_DOCS_PROJECT_ROOT` for repository source files from `ELEMENT_PLUS_DOCS_DOCS_ROOT` for resolving documentation-package dependencies under pnpm's strict layout.
- Preparation uses an exclusive `.generated/prepare.lock`; a concurrent dev/build whose owner process is still running fails visibly at the lock step instead of reading partially generated API or route files. A valid lock contains a positive PID, timestamp, and unique ownership token. A lock whose owner process has exited is removed only while its full owner payload still matches, then exclusive acquisition is retried once, so an interrupted CLI does not permanently block later lifecycle commands. Malformed locks and acquisition races still fail closed. Release removes the path only when its ownership token still matches, so it cannot delete a successor lock. A failed owner-payload write cleans up only an empty, partial, or complete payload that still matches the acquiring owner; a replaced lock is preserved. Process-probe errors other than `ESRCH`, including Windows `EPERM`, are treated as a live or unverifiable owner.
- A provider capability is a maximum. Snapshot resolution may disable it but cannot enable a capability absent from the provider definition.
- Provider-specific environment keys are runtime-only: `GITHUB_TOKEN`, `GITLAB_TOKEN`, `GITEE_TOKEN`, and `YUNXIAO_TOKEN`. Never persist or print them.
- GitLab contributor profiles use `Record<gitlab:<sha256>, exactUsername>`. Resolve every relevant mapping with `GET /users?username=<exactUsername>` and require exactly one response with the same username and a complete provider-owned profile.
- Gitee contributors use `gitee:<numeric-account-id>` from the commit API. Resolve the login from that same commit through the Gitee user API and require both responses to contain the exact same numeric ID and login; a different Gitee account is never an alias.
- Gitee Markdown demo links use `/blame/<branch>/<path>#L<start>`. The `/blob` route renders Markdown without line IDs, and range-shaped anchors do not reliably scroll on direct navigation.
- Yunxiao commit names and emails derive only privacy-safe `yunxiao:<sha256>` mapping keys. `contributorAccounts` maps each reviewed key to one exact Codeup username; it never supplies profile fields. The collector resolves those usernames through the same repository's `/members` API and requires exactly one active member with a stable member ID, user ID, complete `avatarUrl`, exact `username`, and `name`. The persisted contributor key is `yunxiao:<sha256(login)>`. Missing mappings, zero or duplicate matches, inactive/partial members, conflicting profiles, and unsafe avatars fail synchronization; there is no configured-profile, email-based account inference, name-only, or initials fallback. Never persist the source email or invent a profile URL.
- A Yunxiao synchronization token needs only Codeup repository, commit, branch, and member read-only permissions. Tokens remain runtime-only and must be revoked after temporary acceptance work.
- Yunxiao avatar URLs must use the trusted provider-owned HTTPS avatar origin and contain no userinfo, query, or fragment. A verified avatar does not depend on a contributor profile link: contributor cards and commit timelines render the image in a non-link container when `profileUrl` is unavailable.
- Yunxiao source actions use Codeup web routes: directories use `/tree/<branch>/<path>` and files use `/blob/<branch>/<path>`. Non-README Markdown defaults to a preview without line anchors, so Markdown demo links must append Codeup's `?README.md` source-view marker before the exact `#L<start>` anchor. Do not emit a range-shaped anchor: the accepted contract is the exact demo start line. Component source paths must use the component's authoring package path; `RichTextEditor` therefore points to `packages/rich-text-editor` and must never reconstruct the removed `packages/components/src/RichTextEditor` path.
- GitLab component commits are the sole contribution source. Their privacy-safe identity maps to one reviewed exact username, and the GitLab user API supplies the complete `avatarUrl`, `login`, `name`, and `profileUrl` profile used by both contributor and commit-author records.
- Any missing mapping, ambiguous or mismatched lookup, unavailable endpoint, partial profile, unsafe URL, authentication failure, network failure, pagination failure, or malformed payload aborts synchronization and preserves the previous snapshot byte-for-byte.
- A configured GitLab `webBaseUrl` must exactly equal the installation base derived from the repository URL and `projectPath`, including any relative installation path such as `/gitlab`.
- Persisted GitLab web URLs must stay under that exact installation base and contain no userinfo, query, or fragment. This prevents API-returned credential parameters from entering a public snapshot.
- Provider validators, normalizers, capabilities, and selection are tested offline with committed synthetic fixtures. Production snapshots are never used as fixtures or committed to Git.
- The packaged CLI and `./repository/node` entry require Node `>=22.6.0`.
- Turbo's `@moluoxixi/docs#build` must depend on `^build` so dependency packages finish before docs reads their `dist` output.
- Turbo's `@moluoxixi/docs#test` and `@moluoxixi/docs#typecheck` also depend on `^build`, never on the docs `build` task. Required tests and type checks must not synchronize a production provider; the explicit docs build is the only CI phase that does so.
- Browser CI runs in the official Playwright container pinned by version and amd64 digest; the image version must exactly match the locked `@playwright/test` version.
- Linux browser CI runs `test:e2e:functional`, which excludes only tests tagged `@visual`. Functional coverage still includes real-route assertions, responsive desktop/mobile behavior, Demo/Playground/ApiDocs interaction, and browser console/runtime-error collection.
- Screenshot tests remain strict in the full local `test:e2e` suite and use reviewed OS-specific baselines. Do not generate or commit a Linux baseline unless it has been rendered and visually reviewed on Linux; CI must not silently update snapshots.

#### 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| `VITE_DOCS_REPOSITORY_METADATA_PROVIDER` is missing or blank | Select the project's configured `repository.provider` |
| `VITE_DOCS_REPOSITORY_METADATA_PROVIDER` names a registered provider | Generate and validate only that provider's ignored snapshot |
| Unknown provider ID | Throw before reading any snapshot |
| Missing repository config or expectation | Throw with the selected provider ID |
| Repository URL or default branch mismatch | Reject selection |
| Duplicate provider ID or invalid snapshot filename | Reject registry construction |
| Snapshot enables an unsupported capability | Reject resolution |
| GitLab Issue detail URL uses `/-/issues/:iid` or `/-/work_items/:iid` | Accept only when origin, project path, and IID exactly match the snapshot entry |
| GitLab commit detail URL differs by origin, project path, full SHA, query, or hash | Reject the snapshot |
| GitLab profile lookup returns zero, multiple, or a mismatched username | Fail synchronization and preserve the previous snapshot |
| GitLab user or commit endpoint returns any HTTP failure, network error, or malformed data | Fail synchronization and preserve the previous snapshot |
| GitLab contributor profile fields are partial, cross-instance, outside the installation path, or contain query/fragment/userinfo | Fail synchronization or reject the generated snapshot |
| Gitee commit account ID/login and user API ID/login differ | Fail synchronization; never substitute or merge another Gitee account |
| Yunxiao contributor ID is not `yunxiao:` followed by 64 lowercase hexadecimal characters | Reject the generated snapshot or fixture |
| A `.vitepress` snapshot validator imports a Node-only module | VitePress client build must fail; replace it with an explicit browser-compatible runtime dependency rather than weakening validation |
| Yunxiao mapping is missing, member lookup is zero/ambiguous, or the active member's avatar/login/name/IDs are partial or conflicting | Fail synchronization and preserve the previous snapshot |
| Yunxiao avatar URL is outside the trusted provider origin or contains userinfo/query/fragment | Fail synchronization or reject the generated snapshot |
| A preparation child step exits non-zero | Emit `FAIL` with the step, duration, and same exit code; do not run later steps |
| A locale source directory is empty, missing, outside the docs root, or contains a symbolic link | Fail runtime-content preparation before route generation |
| A locale authoring file changes during `element-plus-docs dev` | Project the add/change/delete into `.generated/content` and let the Vite watcher update the runtime page |
| A generated component/utility route is found in an authoring directory or Git index | Reject the path contract; generated routes belong only below `.generated/content/<locale>` |
| A configured package manifest loader is missing/invalid/mismatched | Fail the `playground manifests` preparation step before provider synchronization |
| A Demo imports a runtime root export or subpath absent from a configured manifest | Fail Markdown compilation; do not keep the broad root import or guess dependencies |
| A direct Demo dependency is not resolvable from the documentation package root | Fail with the Demo ID and package name; do not resolve from the theme package or repository root |
| A Demo dependency is visible through hoisting but absent from the documentation package dependency fields | Fail as undeclared; do not accept transitive visibility |
| A declared Demo dependency is installed with a workspace/catalog range | Read the exact installed package version from the documentation package Node resolution paths, including packages that do not export `.` or `./package.json` |
| A declared and installed Demo import is absent from the package `exports` map | Fail with the exact import specifier and Demo ID; do not generate a project that the target bundler cannot import |
| A package exposes its runtime entry but hides `./package.json` | Resolve the package manifest from documentation-package `node_modules` paths and still validate the runtime entry against `exports` |
| Docs `test` or `typecheck` transitively schedules `@moluoxixi/docs#build` | Reject the Turbo contract; tests must stay provider-network-free |
| Yunxiao has a verified avatar/login but no verified profile URL | Render the avatar and login without making the author container a link |
| GitLab `webBaseUrl` differs from the installation base derived from repository URL and `projectPath` | Fail before making API requests |
| Pagination changes API origin or leaves the configured API path | Reject the URL |
| Network `429` or bounded `5xx` | Retry only within the configured limit; redact tokens from errors |
| Yunxiao Markdown source URL omits the source-view marker | Codeup opens the preview and cannot honor the line anchor |
| Yunxiao placeholder identity or all-zero SHA | Reject validation |
| Playwright container version differs from the lockfile | Reject the workflow contract test |
| `element-plus-docs preview` preparation fails | Do not start the preview server; preserve the preparation failure and exit code |
| A valid prepare lock names an exited owner process | Remove the stale lock and retry exclusive acquisition once |
| A prepare lock is malformed, still owned, or replaced during stale-lock recovery | Fail the lock step; do not delete an owner that cannot be proven dead |
| Preview port is already occupied | Fail startup on the requested port; do not choose another port implicitly |
| Linux CI executes the theme browser suite | Run all functional tests and exclude only `@visual` screenshot assertions |

#### 5. Good / Base / Bad Cases

- Good: select `gitlab`, generate and validate only `.generated/repository/gitlab.json`, then construct GitLab actions from the same repository config.
- Good: select `yunxiao`, map an opaque commit identity to one reviewed exact username, resolve its current member profile once, reuse it in both the contributor list and changelog, and generate a Codeup blob URL anchored to the exact demo start line.
- Good: verify `yunxiao:<sha256(login)>` with the browser-compatible synchronous `@noble/hashes` implementation shared by SSR and client bundles.
- Good: resolve an installed direct dependency's exact version from the docs package while separately confirming the original root/subpath import is exported.
- Good: build docs once, then run `element-plus-docs preview --port 4173`; preparation validates current generated/provider state before the existing output is served on that exact port.
- Base: omit the debug environment variable; production and CI generate and select the GitHub snapshot.
- Base: run `test:e2e:functional` in Linux CI and the full `test:e2e` suite on the reviewed local OS.
- Bad: treat the debug environment variable as `auto`, merge snapshots, expose a client-side provider switch, or require a guessed Yunxiao profile URL before showing a verified avatar.
- Bad: call `vitepress preview` directly, let CI update screenshots, or commit a baseline copied from another operating system without visual review.
- Bad: use `node:crypto` in `.vitepress/*-metadata-types.ts`; offline validation may pass while the production client bundle fails.
- Bad: accept a hoisted package, a private subpath, or a package root absent from `exports` merely because its `package.json` can be read.

#### 6. Tests Required

- Registry tests assert unique IDs, action/capability agreement, downgrade-only behavior, and strict provider isolation.
- Provider-selection tests cover the configured default, an explicitly configured override, and an invalid or unconfigured override; only the selected collector and token may be touched.
- URL tests assert platform routes, path/ref encoding, line anchors, issue queries, unsupported actions, and the Yunxiao Markdown source-view marker without adding it to ordinary source files.
- GitLab snapshot tests accept both server-returned Issue detail route families and reject cross-project or mismatched-IID URLs.
- GitLab snapshot tests bind every commit detail URL to the exact repository and full commit SHA, rejecting query and hash suffixes.
- GitLab contributor tests assert explicit stable-ID mappings, exact one-result username lookup, hard failure for every mapping/profile error, atomic snapshot preservation, profile-field atomicity, custom installation paths, and rejection of credential-bearing avatar URLs.
- Gitee collector and snapshot tests assert exact numeric account ID/login agreement across commit and user APIs, rejection of cross-account substitution, provider-owned default avatars, and contributor/commit-author profile consistency.
- Yunxiao collector and snapshot tests assert reviewed opaque-identity mappings, exact active member lookup, required provider-only profiles, `sha256(login)` IDs, profile consistency, trusted avatar origins, hard failure for missing/ambiguous/partial/mismatched results, and absence of persisted emails/tokens.
- The production docs build must execute after snapshot-validator changes so browser-incompatible Node imports cannot hide behind Node-only unit tests or `vue-tsc`.
- Yunxiao theme/browser tests assert avatars in both contributor and changelog views, component tree links, Markdown source-view activation plus exact demo blob line anchors, one ordinary component, and the `packages/rich-text-editor` authoring path.
- Remote provider tests assert every HTTP, mapping, identity, profile, pagination, and validation failure is a hard failure that preserves the prior snapshot; only explicitly unsupported capabilities may be omitted.
- The reusable theme fixture renders a contributor whose profile and avatar live below a self-managed relative installation path, and its VitePress SSR build must succeed.
- API-client tests assert trusted pagination, loop detection, bounded retries, token redaction, and atomic replacement.
- Provider tests assert authentication headers, project identity, branch SHA, component filtering, pagination, normalization, and placeholder rejection.
- Project-config tests assert URL/default inference, package-profile path derivation, strict configured-provider overrides, and that only the selected provider token getter is read.
- Project Markdown tests cover multi-package manifests, root import alias/type-only preservation, direct dependency versions from a real temporary docs root, package.json-hidden packages, private root/subpath exports, undeclared hoisted packages, profile styles, provider line-link routes, and absent manifest exports/subpaths.
- Runtime-content tests cover full rebuild, stale cleanup, zh/en projection, public assets, Git last-updated frontmatter, symlink/path rejection, and dev add/change/delete synchronization.
- Docs route tests rebuild the ignored runtime tree before asserting all localized component/utility pages, includes, and search aliases; they never depend on precommitted generated Markdown.
- Docs integration tests scan every real TS/JS Demo through `elementPlusDocsProjectMarkdownPlugin`; browser compiler import contracts live under `scripts/__tests__`, not a `.vitepress/plugins` pseudo-boundary.
- Packed-package tests import `./repository/node`, execute the installed `element-plus-docs` bin in an isolated Git repository, then render a Demo through the packed public `./markdown` entry and assert the generated manifest, rewritten import, dependency, and style data.
- Root path-contract tests assert Node `>=22.6.0`, offline CI validators, Turbo docs build ordering, and provider-network-free docs test/typecheck task graphs.
- Release-workflow tests assert the Playwright image version, immutable digest, lockfile match, IPC option, and job timeout.
- Theme CLI regression tests assert that `preview` is accepted, runs preparation first, serves from the resolved docs root, forwards the requested port, and never starts the server after a preparation failure.
- Theme functional E2E must prove that the consumer URL is not a 404 fallback before asserting Demo, Playground, ApiDocs, responsive navigation, and absence of browser console/runtime errors.
- Dev-server E2E waits for a positive page-ready signal such as the expected H1
  and brand before negative assertions. Cold Vite transforms use a bounded,
  explicit timeout instead of treating an initially empty DOM as a valid
  `count === 0` result.
- Offline theme fixtures use same-origin, checked-in assets for contributor
  avatars. Browser warning/error collection remains strict; tests do not ignore
  failed requests to fictional external hosts.
- Theme visual E2E is tagged `@visual`; the full local suite compares strict reviewed OS-specific screenshots, while Linux CI uses `--grep-invert "@visual"` and never creates replacement baselines.
- Before commit, run lint, typecheck, tests, snapshot validators, docs build, release checks, and package verification in proportion to the change.

#### 7. Wrong vs Correct

##### Wrong

```ts
const snapshot = gitlabSnapshot ?? githubSnapshot
const provider = environmentProvider || firstValidSnapshot()
const next = await fetch(response.headers.get('link')!)
```

##### Correct

```ts
const repository = resolveElementPlusDocsProjectRepository(project, environmentProvider)
const next = resolveTrustedApiUrl(apiBaseUrl, nextLink, providerName)
```

For the preview lifecycle and browser CI split:

```jsonc
// Wrong: bypasses generated content/provider validation and mixes unreviewed screenshots into Linux CI.
{
  "preview": "vitepress preview",
  "test:ci": "playwright test --update-snapshots"
}

// Correct: uses the theme lifecycle and keeps strict visual review in the full local suite.
{
  "preview": "element-plus-docs preview",
  "test:ci": "playwright test --grep-invert @visual"
}
```

For external Playground dependencies, readable package metadata does not prove that the Demo import is public:

```ts
// Wrong: accepts transitive visibility and private package subpaths.
const version = readPackageJson(packageName).version

// Correct: require a docs-package declaration, installed exact version, and exported original specifier.
assertDocumentationDependency(packageName)
const version = resolveInstalledPackageVersion(packageName)
assertPackageSpecifierExported(specifier)
```

For Yunxiao commit authors, do not tie avatar visibility to an unverified profile route:

```vue
<!-- Wrong: Codeup may provide a verified avatar without a verified profile URL. -->
<a v-if="author.profileUrl"><img v-if="author.avatarUrl" :src="author.avatarUrl"></a>

<!-- Correct: link only when verified; render the avatar in either case. -->
<component :is="author.profileUrl ? 'a' : 'span'" :href="author.profileUrl">
  <img v-if="author.avatarUrl" :src="author.avatarUrl">
</component>
```

For Yunxiao stable contributor IDs, keep the strict hash check browser-compatible:

```ts
// Wrong: .vitepress validators are also bundled for the browser.
import { createHash } from 'node:crypto'

// Correct: synchronous in Node, SSR, and browser bundles.
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'

const id = `yunxiao:${bytesToHex(sha256(new TextEncoder().encode(login)))}`
```

---

## Testing Requirements

- Required provider tests validate synthetic fixtures without provider network access or external tokens. The production docs build synchronizes only selected GitHub metadata with `${{ github.token }}`.
- Explicit maintainer synchronization for GitLab, Gitee, Yunxiao, or local writes ignored snapshots for local validation and never stages them.
- A mocked provider test suite proves protocol behavior; a retained real-platform fixture is still required before claiming platform acceptance.
- Preparation-pipeline tests assert successful and failing step logs, duration/provider/path visibility, exit-code propagation, ordering, early stop, and credential redaction.
- Preview tests assert preparation occurs before serving the existing build, preparation failure prevents server startup, the resolved docs root is used, and an occupied requested port fails without fallback.
- Linux CI runs the functional theme E2E suite and uploads its Playwright report/test-results on failure. Strict `@visual` screenshot tests remain in the full local suite with reviewed OS-specific baselines.
- Cold-start fixture tests first await a positive heading/brand signal before
  asserting absent elements. Contributor avatar coverage verifies the
  same-origin image completed loading while retaining an empty browser-problem
  list.
- Fixture files live under `packages/vitepress-theme-element-plus/test/repository/fixtures/` and use fixed fictional identities/components; they must not import production site config, manifest, or expectation data.

---

## Code Review Checklist

- Provider selection remains explicit and production stays on the intended provider.
- Snapshot, expectation, repository config, and URL actions all belong to the same provider.
- GitLab contributor mappings contain reviewed exact usernames only; snapshots never contain commit emails or credential-bearing profile/avatar URLs.
- Gitee snapshots bind the exact committing numeric account ID to its exact login and provider-owned profile; distinct Gitee accounts are never treated as aliases.
- Yunxiao snapshots contain only complete Codeup member API profiles keyed by `sha256(login)`; mappings select exact usernames but never inject profiles, and snapshots never contain commit emails, tokens, untrusted avatar URLs, or guessed profile URLs.
- Capability flags match both available actions and normalized output.
- Pagination cannot escape the configured API boundary and retry loops are bounded.
- Tokens are optional where anonymous reads are supported, runtime-only, and redacted from failures.
- Required provider tests remain offline; only the selected production GitHub docs build performs synchronization, and pre-commit never refreshes or stages metadata.
- Docs builds retain dependency ordering and the documented Node minimum matches `package.json`.
- Browser CI uses the lockfile-matched, digest-pinned Playwright image and keeps a bounded job timeout.
- Preview scripts use `element-plus-docs preview`, not the raw VitePress command, and do not promise preview options unsupported by the locked VitePress version.
- Linux CI excludes only `@visual`; functional responsive and runtime-error coverage remains mandatory, and screenshot baselines are never updated automatically.
