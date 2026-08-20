# Implementation Plan

- [x] Add a typed GitLab contributors response and strict response normalizer.
- [x] Fetch repository contributors before component normalization and use the
      records to canonicalize matching contributor names.
- [x] Add 404/405 fallback and 401/403/malformed-response regression tests.
- [x] Re-run GitLab/provider validators, docs checks, lint, typecheck, and build.

## Verification

- `pnpm --filter @moluoxixi/docs exec vitest run scripts/__tests__/gitlab-metadata.test.ts scripts/__tests__/repository-metadata.test.ts` - 45 tests passed.
- `pnpm -C docs/vitepress sync-gitlab-metadata` - synchronized 13 JiHu components at `af9833f`.
- `pnpm -C docs/vitepress validate-repository-metadata` - GitHub, GitLab, Gitee, and local snapshots passed offline validation.
- `pnpm exec eslint docs/vitepress/scripts/gitlab-metadata.mts docs/vitepress/scripts/__tests__/gitlab-metadata.test.ts` - passed.
- `pnpm -C docs/vitepress typecheck` - passed.
- `pnpm -C docs/vitepress build` - passed with existing Sass, chunk-size, and dynamic-import warnings only.
- Snapshot review confirmed the exact `moluoxixi` username, avatar, and profile URL and found no email, token, cookie, query-bearing URL, or credential field.
- [x] Review the snapshot and task notes for credential leakage, then commit and
      push the completed change.
