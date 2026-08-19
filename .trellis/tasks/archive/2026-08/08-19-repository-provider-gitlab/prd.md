# GitLab repository provider

## Goal

Extract the reusable repository-provider contract into the theme package, implement strict GitLab metadata/link support, and prove it against a real GitLab project while production remains on GitHub.

## Requirements

- Export normalized metadata types, provider registry/capability policy, and GitHub/GitLab URL adapters from `@moluoxixi/vitepress-theme-element-plus`.
- Keep site selection, API client, credentials, manifests, snapshot schema, and snapshot files in `docs/vitepress`.
- Support GitLab.com and self-managed instances through explicit web/API base URLs and full subgroup-aware project paths.
- Register only the `gitlab` snapshot for GitLab; never fall back to GitHub/local.
- Synchronize default-branch HEAD, component-scoped commits, contributor counts, and component-prefixed open Issues through REST v4.
- Derive Issues capabilities from project state. Do not fabricate contributor profile/avatar links when user identity is ambiguous.
- Use optional `GITLAB_TOKEN`, anonymous public reads, encoded project paths, pagination, bounded retry/rate-limit handling, strict validation, and atomic writes without leaking secrets.
- Create and retain a public JiHu GitLab fixture project with representative CopyText content, multiple commits, and an open Issue.
- Keep GitHub Pages/npm deployment workflows unchanged and keep required CI independent of live GitLab.

## Acceptance Criteria

- [x] Package-root exports expose the shared contract and exact GitHub/GitLab action builders.
- [x] The registry contains `gitlab`, while production still selects `github` and GitHub/local regression tests pass.
- [x] GitLab config supports subgroups and explicit self-managed web/API roots.
- [x] GitLab snapshots reject wrong identity, branch, manifest, SHA, URL, capability state, and cross-provider input.
- [x] Exact tree/blob/edit/commit/issues URLs and `#Lstart-end` anchors are tested.
- [x] Disabled Issues remove counts/actions; enabled Issues expose them.
- [x] Contributor counts render without unverified profiles.
- [x] The client/sync tests cover token headers, anonymous reads, pagination, retry, component filtering, rate limits, secret redaction, and atomic replacement.
- [x] A real public JiHu GitLab project proves anonymous source/line/commit/issue links, logged-in edit/new-Issue flows, and live metadata synchronization.
- [x] Focused and full repository checks pass, changes are committed/pushed, and GitHub Actions succeeds.

## Out of Scope

- Switching production to GitLab or adding GitLab CI/deployment.
- Implementing Gitee or Yunxiao in this child.
- Deleting the remote fixture automatically.

