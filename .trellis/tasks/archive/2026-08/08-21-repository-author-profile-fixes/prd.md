# Enforce provider-only repository metadata

## Goal

Make every repository metadata snapshot authoritative for its selected source:
remote providers use only their own APIs, Local uses only local Git, and any
remote fetch, identity, mapping, or validation failure aborts synchronization
without replacing the last successful snapshot. Contributor cards and commit
timelines must display the exact provider account that authored each commit,
including that account's current provider-owned profile state.

## Confirmed Facts

- Remote collectors currently obtain commit history from their own provider APIs;
  only the Local collector invokes the local `git` executable.
- Some remote collectors still turn missing or invalid identities into name-only,
  initials-only, configured-profile, embedded-author, or different-account
  fallbacks. Those records pass the current snapshot validators and can overwrite
  a valid prior snapshot.
- Provider sync entry points already validate before atomic replacement, so a
  thrown collector or validation error preserves the committed snapshot.
- The theme already renders complete contributor and commit-author profiles; the
  defect is in collection and snapshot validation, not in presentation.

## Requirements

- GitHub, GitLab, Gitee, and Yunxiao must source repository metadata exclusively
  from the selected provider's API responses. They must not scan local Git, read
  another provider's snapshot, or inject profile data from another provider.
- Local is the only provider allowed to scan local Git. Its configuration must be
  independently declared rather than aliasing another provider's configuration.
- Any remote API, pagination, mapping, identity resolution, profile lookup, schema,
  URL-trust, or snapshot validation failure must fail synchronization and leave
  the previous snapshot byte-for-byte unchanged.
- A capability for which a provider has no API may be declared unsupported and
  omitted. Runtime HTTP/API failures must not be reclassified as unsupported,
  and unsupported capabilities must not be populated from another source.
- Reviewed mappings may resolve an opaque provider commit identity to the exact
  same provider account when the commit API does not expose a queryable username.
  They must never merge two provider accounts or supply substitute avatar,
  profile URL, display name, or other profile data.
- Every persisted remote contributor and commit author must contain one atomic,
  provider-verified profile. GitHub, GitLab, and Gitee require `avatarUrl`,
  `login`, `name`, and `profileUrl`; Yunxiao requires its API-supported
  `avatarUrl`, `login`, and `name` and must not guess an unsupported profile URL.
  Name-only, initials-only, unknown-author, substitute-avatar, and configured
  profile fallbacks are not valid remote snapshot states.
- Reuse the existing reviewed GitLab identity mapping for both the aggregated
  contributor and every matching commit author, and require its GitLab user API
  lookup to resolve successfully.
- Use the stable numeric Gitee account ID returned by the commit API as the
  contributor key and resolve the exact login returned by that same API through
  the Gitee user API. No Gitee account alias is allowed.
- For the fixture commits, preserve the author identity
  `gitee:9153520 / wl1983531544`. Do not use `10811655 / moluoxixi`, because it is
  a distinct Gitee account that did not author those commits.
- A provider-owned default avatar, including Gitee's `assets/no_portrait.png`, is
  valid when returned for the exact committing account. It must not be replaced
  with another account's avatar or a cross-provider image.
- Apply each verified profile consistently to the aggregated contributor and
  every matching commit author. Missing, ambiguous, forbidden, not-found,
  malformed, mismatched, or unsafe profile results must abort synchronization.
- Yunxiao commit names and emails may only derive privacy-safe mapping keys. Each
  reviewed key selects one exact Codeup username; the repository members API must
  return exactly one active member with that username and supplies its current
  name and avatar. The token therefore requires repository, commit, branch, and
  member read-only permissions. Raw commit identities never enter a snapshot.
- Keep provider tokens runtime-only and preserve the existing trusted API URL,
  retry, redaction, pagination, and atomic snapshot replacement boundaries.
- Regenerate and review affected provider snapshots without email, token,
  credential-bearing or query-bearing URLs, or fallback identities.
- Keep production provider selection on GitHub and do not change theme rendering
  or playground behavior.

## Acceptance Criteria

- [x] Each GitLab CopyText contributor and commit author uses the same GitLab API
      account profile resolved for that commit identity.
- [x] Gitee fixture commits authored by account `9153520 / wl1983531544` display
      that exact account and its Gitee-provided avatar/profile state; they never
      display account `10811655 / moluoxixi`.
- [x] GitHub, GitLab, Gitee, and Yunxiao collectors have no local-Git,
      cross-provider, name-only, initials-only, unknown-author, configured-profile,
      or different-account fallback path.
- [x] A simulated API, mapping, identity lookup, or profile validation failure for
      every remote provider rejects synchronization and leaves the previous
      snapshot byte-for-byte unchanged.
- [x] A provider capability with no API is represented only as explicitly
      unsupported/omitted; it does not trigger local or cross-provider collection.
- [x] Gitee contributors are keyed by `gitee:<numeric-account-id>`; the commit API
      account ID/login and user API account ID/login must match exactly. Missing
      identities, mismatches, or unsafe URLs reject synchronization.
- [x] No mapping or heuristic can merge two distinct accounts on the same
      provider; provider-owned default avatars remain attached to their exact
      account.
- [x] Remote snapshot validators require atomic author profile fields, trusted
      provider URLs, exact profile routes, and exact account consistency.
- [x] No affected snapshot contains an email, token, credential-bearing URL,
      query-bearing profile URL, cross-account avatar, or fallback identity.
- [x] Focused collector, validator, normalization, type-check, lint, aggregate
      snapshot validation, and production documentation build checks pass.
- [x] Local GitLab and Gitee documentation instances visibly show the corrected
      avatar in both contributor cards and commit timelines.

## Out Of Scope

- Automatic identity guessing from repository owner, display name, or email.
- Merging anonymous Git identities with provider accounts without a reviewed map.
- Adding repository capabilities for which the selected provider exposes no API.
- Changing theme rendering, source-link semantics, Issues UX, or playgrounds.
