# Multi-platform repository providers

## Goal

Provide production-grade GitLab, Gitee, and Yunxiao Codeup repository integrations for the reusable Element Plus documentation theme. Each platform must be strictly selectable, work from its own offline metadata snapshot, and be verified against a real project. GitHub remains the selected production provider.

## Background

- The documentation currently supports strictly separated `github` and `local` providers.
- Repository metadata drives component commit history, contributors, source/edit links, demo source-line links, issue counts, and issue actions.
- The generic provider contract currently lives in the documentation site, which prevents reuse by another component library.
- GitLab, Gitee, and Yunxiao expose different repository APIs and web routes. Yunxiao has no repository-level Issues equivalent.
- GitHub Actions owns this repository's CI, GitHub Pages deployment, and npm publishing. Source-management provider support is independent from the platform that deploys the site.

## Requirements

### R1. Reusable Platform Contract

- Export the platform-neutral metadata contract, provider registry, capability policy, and platform URL action adapters from `@moluoxixi/vitepress-theme-element-plus`.
- Keep site credentials, API clients, component manifests, provider selection, snapshots, and snapshot validation in `docs/vitepress`.
- Preserve existing GitHub/local behavior and package API compatibility.

### R2. Strict Provider Selection

- Register independent `gitlab`, `gitee`, and `yunxiao` providers in addition to `github` and `local`.
- Use separate provider-scoped configuration and snapshot files. Do not provide `auto` selection or cross-provider fallback.
- Allow repository-level capability downgrades so disabled or unavailable platform features are not rendered.

### R3. Platform Deliverables

- GitLab: implement GitLab.com and self-managed support, including subgroup project paths and repository-level Issues state.
- Gitee: implement public-cloud support and configurable enterprise base URLs without assuming enterprise API compatibility.
- Yunxiao: implement Codeup repository metadata and links using canonical API data; expose no repository Issue actions and do not map Projex work items to Issues.
- Each platform must have its own schema, collector, sync command, validation command, deterministic tests, and tracked offline snapshot.

### R4. Real Project Verification

- Use authenticated browser/computer sessions to create or provision clearly test-only projects on GitLab, Gitee, and Yunxiao.
- Verify every enabled capability against the real platform UI and API, including source files, line anchors, commits, edit flows, contributors, and Issues where supported.
- Verify anonymous behavior for public GitLab/Gitee projects and authenticated behavior for Yunxiao private/internal repositories.
- Retain validation projects for repeatable checks; do not delete them without explicit permission.

### R5. CI and Deployment Boundary

- Keep `docsSite.metadataProvider` set to `github` for production.
- Run deterministic provider fixtures, mocked clients, snapshot validators, typechecks, and docs/theme builds in existing GitHub Actions CI.
- Do not require live external tokens or live platform availability in required CI.
- Do not add GitLab/Gitee/Yunxiao deployment pipelines unless separately requested.

## Task Map

- `08-19-repository-provider-gitlab`: extract the shared package contract, implement GitLab first, and perform real GitLab validation.
- `08-19-repository-provider-gitee`: implement Gitee on the shared contract and perform real Gitee validation.
- `08-19-repository-provider-yunxiao`: implement Yunxiao Codeup with explicit capability limits and perform real tenant validation.

Execution order is GitLab, then Gitee, then Yunxiao. Later children depend on the shared contract established by the GitLab child.

## Acceptance Criteria

- [ ] The theme package publicly exports reusable provider contracts and GitHub/GitLab/Gitee/Yunxiao action adapters.
- [ ] The site registry contains `github`, `local`, `gitlab`, `gitee`, and `yunxiao`, while production selection remains `github`.
- [ ] Every provider uses an independent schema and snapshot with no automatic fallback.
- [ ] Repository-level capabilities match actual platform/project behavior; unsupported data and actions are absent from the UI.
- [ ] GitLab, Gitee, and Yunxiao collectors pass deterministic authentication, pagination, retry, filtering, validation, and atomic-write tests.
- [ ] Real projects prove the enabled links and metadata for all three platforms, with credentials absent from tracked files, snapshots, build output, and logs.
- [ ] Existing GitHub/local behavior and all GitHub Actions quality/release checks remain green.
- [ ] Chinese and English documentation explain selection, configuration, credentials, capability differences, synchronization, and deployment independence.

## Out of Scope

- Switching the production site away from GitHub.
- Creating `.gitlab-ci.yml`, Gitee Go, or Yunxiao Flow deployment/release pipelines.
- Treating Yunxiao Projex work items or change requests as repository Issues.
- Claiming anonymous Yunxiao repository access when Codeup visibility does not provide it.
- Automatically deleting remote validation projects.

