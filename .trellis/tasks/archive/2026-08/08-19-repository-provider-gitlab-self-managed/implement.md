# Implementation Plan

## 1. Contracts and configuration

- [x] Extend the GitLab docs-site configuration with exact contributor-profile mappings and explicit authentication mode where needed.
- [x] Keep production provider `github` and preserve strict independent snapshots.
- [x] Extend GitLab snapshot contributor fields and validators for optional verified profile data without permitting email serialization.

## 2. Collector and trust boundaries

- [x] Resolve mapped usernames through exact `GET /users?username=` lookups and reject zero, multiple, mismatched, or cross-origin profiles.
- [x] Preserve hash-ID/initials fallback for every unmapped or unverifiable commit author.
- [x] Cover custom web/API origins with relative deployment paths, nested project paths, private-project authentication, trusted pagination, retries, redaction, and atomic replacement.
- [x] Distinguish project authentication failures from legitimate capability downgrades.

## 3. Provider and UI integration

- [x] Enable contributor-profile capability only when the normalized contract can carry verified profiles; retain per-contributor fallback.
- [x] Verify generic UI renders avatar/profile links for mapped contributors and initials for unmatched contributors without GitLab-specific UI branches.
- [x] Replace host-specific GitHub labels in generic repository/source actions with provider-neutral or provider-derived labels where they remain visible under GitLab.

## 4. Tests and documentation

- [x] Add collector/schema/provider/action tests for exact mappings, ambiguity rejection, privacy, custom relative origins, auth modes, version/route variants, and provider isolation.
- [x] Update Chinese and English documentation for the two-step profile mapping workflow, self-managed configuration, private projects, trusted certificates/proxies, and compatibility limits.
- [x] Synchronize the retained JiHu snapshot and verify the updated avatar/profile without persisting tokens or emails.

## 5. Completion gate

- [x] Run focused tests, metadata validators, lint, typecheck, full tests, docs build, package build/pack verification, and browser checks.
- [x] Review the exact diff and snapshots for credentials/private data.
- [x] Update approved specs if the provider contract gains a reusable invariant.
- [x] Commit and push; wait for CI, Pages, and package-release workflows to succeed or intentionally skip.
- [ ] Archive this child, then resume Yunxiao followed by Tencent provider planning/implementation.

## Rollback points

- Contributor profile mapping can be removed independently while keeping hash contributors.
- Self-managed auth/config extensions must remain backward-compatible with the existing JiHu configuration.
- Do not alter production provider selection as part of rollback or rollout.
