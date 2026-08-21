# Design: Provider-only repository metadata

## Source Boundary

| Provider | Allowed source | Forbidden behavior |
| --- | --- | --- |
| GitHub | GitHub APIs | Local Git, other providers, partial/name-only profiles |
| GitLab | Configured GitLab instance APIs | Local Git, other instances/providers, partial/name-only profiles |
| Gitee | Gitee APIs | Local Git, other providers, or another Gitee account's profile |
| Yunxiao | Yunxiao APIs | Local Git, configured substitute profiles, other providers |
| Local | Local Git | Remote provider APIs or aliased provider configuration |

An explicitly unsupported provider capability remains absent. An API request that
fails, returns an unusable identity, or violates its schema is a synchronization
failure, not evidence that the capability is unsupported.

## Data Flow

```text
Selected provider API
  -> stable contributor ID
  -> reviewed ID-to-username mapping
  -> exact provider user lookup
  -> validated profile map
  -> contributor aggregation + commit author projection
  -> strict committed snapshot
  -> platform-neutral repository metadata
  -> existing contributor and timeline components
```

The bug lives before snapshot persistence. The theme already renders complete
profiles correctly, so provider-specific identity logic remains in collectors and
snapshot validators. A remote mapping may only resolve an opaque commit identity
to the same provider account; it cannot alias two distinct accounts. Profile
fields always come from the selected provider API for the exact author account.

## Failure Contract

Collectors return a complete valid snapshot or throw. They never emit a degraded
snapshot. API, pagination, authentication, authorization, mapping, identity,
profile, URL, or schema failures propagate to the sync entry point. Snapshot
validation runs before atomic replacement; any exception leaves the existing
snapshot untouched. Tests compare the prior snapshot bytes after representative
failure cases.

The same contract applies to GitHub, GitLab, Gitee, and Yunxiao. Local remains a
separate provider with local-Git semantics and an independently declared config.

## GitLab Contract

GitLab keeps its privacy-safe SHA-256 contributor ID and existing exact username
mapping. The mapping selects an exact username; `/users?username=...` supplies
the profile. `createComponentMetadata` projects the verified profile into both
the contributor entry and matching commit authors. Missing contributors endpoints,
forbidden/not-found user lookups, ambiguity, mismatches, and unsafe profile data
throw instead of aggregating a name-only replacement. The snapshot validator
requires the full `{ avatarUrl, login, name, profileUrl }` shape.

## Gitee Contract

Gitee account commits use `gitee:<numeric-id>` as the stable contributor key
instead of a mutable login. The collector takes both numeric ID and login from
the commit API, resolves `/users/:login`, and requires the user API to return the
same numeric ID and login. It validates the profile route, avatar origin, and
absence of credentials/query/fragment.

For the fixture history, this means `9153520 / wl1983531544` remains the author.
`10811655 / moluoxixi` is a distinct account and is never considered. If Gitee
returns `assets/no_portrait.png` for `wl1983531544`, that provider-owned default
avatar is the accurate state of the committing account and remains attached to
it. Missing, unavailable, malformed, mismatched, or unsafe lookups throw; names,
email, repository ownership, or avatar preference never trigger account merging.

## GitHub And Yunxiao Contract

GitHub resolves each API-associated account through the GitHub user API and
rejects null/unresolved account identities instead of using embedded Git names.
The Yunxiao commit API exposes Git author name/email for the fixture history but
does not expose a Codeup account object. Those fields derive only a privacy-safe
identity hash. A reviewed mapping selects one exact Codeup username, then the
same repository's members API must return exactly one active matching member and
supplies the atomic `avatarUrl`, `login`, and `name` profile. Configuration never
supplies profile fields, and zero, duplicate, inactive, partial, mismatched, or
unsafe member responses fail synchronization. Yunxiao has no persisted profile
URL in this contract, so that field remains unsupported rather than guessed. If
a provider genuinely exposes no API for a capability, that capability is
explicitly unsupported rather than synthesized.

## Compatibility And Rollback

- Snapshot schema version remains `1`; remote author records become stricter
  within the platform-neutral repository metadata contract. Provider-owned
  default avatars remain compatible because they belong to the exact account.
- Required CI remains offline and validates committed snapshots only.
- Rollback is the collector/schema/config/snapshot commit as one unit. Failed
  live synchronization automatically retains the previous committed snapshot;
  no stored application data migration is involved.
