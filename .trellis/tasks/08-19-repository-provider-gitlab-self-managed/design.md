# Design: GitLab self-managed and contributor profiles

## Boundaries

`@moluoxixi/vitepress-theme-element-plus` remains platform-neutral. Its existing contributor model and UI already accept optional `login`, `avatarUrl`, and `profileUrl`; no GitLab host or API behavior belongs in the theme.

`docs/vitepress` owns GitLab instance configuration, authentication, contributor mappings, API calls, schema validation, snapshots, and provider capability selection. Production selection remains `github`.

## Contributor Identity

GitLab commit and repository-contributor APIs expose Git author name/email but no verified GitLab account. Name/email search is not a reliable account link because commit identities are user-controlled and account emails can be private.

Keep the current privacy-preserving contributor ID derived from normalized commit name/email and never serialize the email. Add an optional provider-scoped mapping from that stable contributor ID to an exact GitLab username:

```ts
contributorProfiles: {
  'gitlab:<sha256>': 'moluoxixi',
}
```

For each configured username, call `GET /users?username=<exact>`. Accept exactly one response whose username matches exactly and whose profile URL belongs to the configured GitLab web origin/path. Merge the verified account fields into the contributor while retaining the existing contributor ID and contribution count. Missing, ambiguous, or invalid responses retain the initials-only fallback.

This is a deliberate two-step workflow: synchronize once to discover stable contributor IDs, configure reviewed mappings, then synchronize again to enrich profiles. It avoids persisting private email addresses and avoids automatic identity guesses.

## Self-Managed Configuration

Retain explicit provider selection and extend the GitLab repository configuration around these values:

- `webBaseUrl` and `apiBaseUrl`, including relative-URL installations such as `https://gitlab.example.com/gitlab` and `/gitlab/api/v4`.
- subgroup-capable `projectPath` and expected `defaultBranch`.
- provider-scoped contributor profile mappings.
- an explicit authentication mode for supported GitLab headers while keeping the token in `GITLAB_TOKEN` only.

The collector continues to use API-relative paths and the shared trusted-URL resolver. Pagination must remain inside the exact configured API origin and normalized base path. Repository, issue, commit, profile, avatar, source, edit, and line URLs are validated against their relevant trust boundaries before entering a snapshot.

Private projects fail clearly on authentication/authorization errors. Feature-specific absence may downgrade a capability only after the project itself has already been authenticated and validated. The implementation must not turn an unknown project or bad token into an apparently valid “feature disabled” snapshot.

## Version and Capability Policy

The common project/branch/commit/issue APIs remain API v4 based. Instance metadata/version probing is diagnostic and must not make public SaaS synchronization fail when the endpoint is access-restricted. Tests cover representative old/new response and UI-route variants rather than claiming an unverified universal minimum version.

Work-item detail URLs returned by modern GitLab remain accepted, while issue list/create actions keep their established Issues routes unless an instance explicitly proves an alternative. Unsupported contributor profiles or Issues are downgraded; generic UI reads only effective capabilities.

## Validation Strategy

- Live JiHu validation proves exact-username profile lookup and the updated avatar for the retained fixture.
- Deterministic tests use a custom self-managed origin with a `/gitlab` relative path, nested project path, private-token authentication, pagination, account mapping, and old/new issue URL variants.
- Existing GitLab isolation, strict URL identity, retry/redaction, atomic-write, docs build, public package, and GitHub production-provider tests remain green.
- A local GitLab CE container is an additional acceptance check when Docker is available. The current Docker daemon is unavailable, so deterministic self-managed contract coverage plus retained JiHu evidence is the completion baseline for this iteration.

## Rollback

Contributor enrichment is additive and optional. Removing the mapping or disabling profile capability returns to the existing initials-only behavior without changing contributor counts. Self-managed configuration changes remain isolated to the GitLab provider and can be reverted without affecting GitHub/local/Gitee/Yunxiao snapshots.
