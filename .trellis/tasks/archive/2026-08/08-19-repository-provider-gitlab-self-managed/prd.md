# GitLab self-managed and contributor profiles

## Goal

Complete GitLab self-managed compatibility and enrich GitLab contributors with verified account profiles and avatars.

## Background

- The existing GitLab provider is validated against the retained public JiHu GitLab fixture at `moluoxixi/vue-components-provider-fixture`.
- Component contributor counts currently come from commit author name/email identities. GitLab account login, avatar, and profile URL are not populated.
- The fixture owner's avatar has been updated, so the live JiHu API must be rechecked before deciding whether account enrichment is unavailable.
- Production documentation must remain on the explicit `github` provider. GitLab work continues to use its independent snapshot without fallback.

## Requirements

- Re-query the retained JiHu fixture and determine whether each component commit author can be mapped to one exact GitLab account without name-only guessing.
- Enrich GitLab contributors with stable account identity, display name, avatar URL, and profile URL when the platform supplies verifiable evidence; retain safe initials-only fallback for unmatched authors.
- Support GitLab self-managed instances through explicit instance configuration, including custom web/API base URLs, subgroup project paths, private projects, and provider-scoped runtime credentials.
- Define and test compatibility behavior for relevant GitLab CE/EE API and web-route differences. Unsupported instance capabilities must be downgraded instead of guessed.
- Validate URL trust boundaries, pagination, retries, token redaction, atomic snapshot replacement, and exact repository/project identity for custom GitLab origins.
- Add deterministic mocked/version-variant tests and perform retained real-instance validation where the local environment permits it.
- Keep all required CI offline; do not persist tokens, cookies, private email addresses, or other credentials in snapshots, logs, or task artifacts.
- Update Chinese and English provider documentation with self-managed configuration, authentication, compatibility limits, and contributor-profile semantics.
- Finish and commit this child before resuming the existing Yunxiao task or the newly created Tencent provider task.

## Acceptance Criteria

- [x] A fresh JiHu synchronization maps contributor `gitlab:c5bd8c158c76d1ee0e04dfc5460fa34092caf55172fe6154706c94ce08ddc31b` to the exact `moluoxixi` username and renders its updated avatar/profile on the CopyText page.
- [x] Contributor enrichment never links a commit author to an account based only on an ambiguous display-name match.
- [x] GitLab.com/JiHu-style SaaS and configurable self-managed origins share one provider contract without host-specific branches in generic UI code.
- [x] A custom-origin private/subgroup fixture passes collector, schema, snapshot, URL-action, capability, and documentation-build tests.
- [x] Older/newer supported route variants are covered by deterministic tests; unavailable features are omitted from effective capabilities.
- [x] Production provider remains `github`, GitLab snapshot isolation remains strict, and no live network/token is required by CI.
- [ ] Focused and full quality checks pass, implementation is committed and pushed, and resulting CI/Pages/package workflows succeed or intentionally skip.

## Out of Scope

- Switching production documentation away from GitHub.
- Adding GitLab CI/CD deployment pipelines.
- Persisting private contributor email addresses to make account matching easier.
- Resuming Yunxiao or Tencent implementation before this child reaches its completion gate.
