# Gitee repository provider

## Goal

Implement a strict Gitee repository provider on the shared theme contract and prove public-cloud behavior against a real Gitee project, while keeping production on GitHub.

## Requirements

- Add independent Gitee configuration, actions, schema, snapshot, normalizer, REST v5 collector, sync/validation commands, and deterministic tests.
- Support public Gitee and configurable web/API roots for enterprise instances, but do not claim enterprise compatibility without instance validation.
- Synchronize default branch HEAD, component commits, contributors/profiles when identity is verified, and component-prefixed open Issues.
- Use optional environment credentials according to Gitee's API contract, redact them from URLs/logs, paginate responses, handle rate limits/retries, validate strictly, and write atomically.
- Implement exact Gitee tree/blob/edit/commit/issue routes and range anchors without reusing GitHub/GitLab templates.
- Create and retain a public Gitee fixture project and validate anonymous and authenticated behavior in the browser.
- Keep required CI deterministic and offline; do not add Gitee deployment pipelines.

## Acceptance Criteria

- [ ] The registry contains `gitee` with its own snapshot and no fallback; production remains `github`.
- [ ] Gitee public-cloud and configurable enterprise base URLs are represented explicitly.
- [ ] Exact source/edit/commit/issue URLs and `#Lstart-Lend` anchors are tested and verified on a real project.
- [ ] Snapshot assertions reject wrong owner/repository/branch/manifest, malformed data, and cross-provider input.
- [ ] Client/sync tests cover credentials, redaction, pagination, rate limits, retry, component filtering, Issue filtering, profiles, and atomic writes.
- [ ] A real public project proves source, line, commit, contributor, edit, Issue, and live metadata synchronization behavior.
- [ ] Documentation, focused/full checks, commit/push, and GitHub Actions succeed.

## Out of Scope

- Claiming that every Gitee Enterprise version has public-cloud-compatible APIs/routes.
- Switching production or adding Gitee Go deployment.
- Implementing Yunxiao in this child.

