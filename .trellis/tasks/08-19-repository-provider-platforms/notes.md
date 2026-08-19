# Validation Notes

## 2026-08-19 Implementation State

- User approved implementation for the GitLab, Gitee, and Yunxiao children.
- Shared contracts, provider clients, independent snapshots, validators, tests, documentation, and offline CI wiring are present in the working tree.
- Production remains `github`; required CI performs committed-snapshot validation and does not contact external providers.
- Real retained-project acceptance remains open for all three platforms. Do not complete or archive the parent or children until that evidence and final commit/push/CI results are recorded.
- The first two GitHub Actions attempts repeatedly stalled while dynamically installing Chromium. The browser job now uses the digest-pinned official Playwright image matching the lockfile version and retains all browser suites.
