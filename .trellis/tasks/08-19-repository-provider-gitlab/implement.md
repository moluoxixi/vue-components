# GitLab Implementation Plan

- [ ] Run `trellis-before-dev` for docs and theme package scopes.
- [ ] Extract the generic provider module and GitHub actions into the theme package with compatibility tests.
- [ ] Add effective capability downgrades and GitLab actions with package-root exports.
- [ ] Add provider-scoped GitLab configuration, schema/assertion, normalization, snapshot, and strict registry entry.
- [ ] Add the injectable GitLab REST client plus explicit atomic sync/validation scripts and package commands.
- [ ] Add focused theme/docs tests for contracts, URLs, schema isolation, API behavior, retries, and atomic writes.
- [ ] Create/provision the real public GitLab fixture and validate UI/API behavior without storing credentials.
- [ ] Update Chinese/English provider documentation.
- [ ] Run focused tests, typechecks, all snapshot validators, and the complete GitHub Actions-equivalent suite.
- [ ] Review the diff, commit/push the child changes, and confirm GitHub Actions succeeds.

Rollback gate: production selection must remain `github`; no token or browser-session data may be tracked.

