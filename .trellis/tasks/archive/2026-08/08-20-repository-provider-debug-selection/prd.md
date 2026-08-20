# Repository provider debug selection

## Goal

Allow local docs development and one-off builds to select a committed repository
metadata provider without editing source configuration, while production keeps
GitHub as the default.

## Requirements

- Read `VITE_DOCS_REPOSITORY_METADATA_PROVIDER` at Vite/VitePress startup.
- Accept only the registered provider IDs: `github`, `local`, `gitlab`, `gitee`,
  and `yunxiao`.
- Default to `github` when the variable is missing or blank; reject unknown values
  before selecting or loading a snapshot.
- Keep provider selection strict: no automatic fallback or cross-provider merge.
- Document local GitLab startup commands for PowerShell and POSIX shells.

## Acceptance Criteria

- [x] The resolver has deterministic default, supported-value, and invalid-value tests.
- [x] Starting docs with `VITE_DOCS_REPOSITORY_METADATA_PROVIDER=gitlab` validates
      and renders the committed GitLab snapshot.
- [x] Starting without the variable still selects GitHub.
- [x] Focused tests, lint, and typecheck pass.

## Notes

- This is a debug/build-time selector, not a user-facing runtime switch.
- Yunxiao remains unavailable until its placeholder configuration is replaced.

## Verification

- Focused provider tests: 29 passed in both default and GitLab-selected environments.
- Selected snapshot validation: GitLab `af9833f`; default GitHub `a3bb24a`.
- Full repository lint and docs TypeScript checks passed.
- GitLab-selected VitePress production build completed successfully.
