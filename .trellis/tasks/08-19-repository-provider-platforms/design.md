# Design: Multi-platform repository providers

## Architecture

The theme package owns normalized repository types, provider capabilities, registry enforcement, capability filtering, platform-specific web-link adapters, provider schemas/collectors, generated snapshot tooling, CLI orchestration, and the pure adapter from normalized repository metadata to theme content. The documentation site owns only repository identity/configuration, runtime credentials, and its component/package catalog.

The provider's declared capabilities are its maximum support. A snapshot may only downgrade them for a repository, for example when GitLab Issues are disabled or a Yunxiao tenant route cannot be verified. Generic rendering reads only effective capabilities and never branches on a platform ID.

## Strict Configuration

Use a single explicit provider ID and a provider-scoped configuration map:

```ts
metadataProvider: 'github',
repositories: {
  github: { ... },
  local: { ... },
  gitlab: { webBaseUrl, apiBaseUrl, projectPath, ... },
  gitee: { webBaseUrl, apiBaseUrl, owner, repository, ... },
  yunxiao: { apiBaseUrl, organizationId, repositoryId, ... },
}
```

There is no `auto` mode and no snapshot fallback. Tokens are read only from provider-specific environment variables and are never serialized.

## Platform Capability Baseline

| Capability | GitLab | Gitee | Yunxiao Codeup |
| --- | --- | --- | --- |
| Commit history | Yes | Yes | Yes |
| Contributors | Yes | Yes | Aggregate from commits |
| Contributor profiles | No unless identity is deterministic | Yes when API identity is verified | No by default |
| Source/line links | Yes | Yes | Enable only after real tenant route validation |
| Edit links | Yes with permission | Yes with permission | Enable only after real tenant validation |
| Repository Issues | Repository-configured | Yes | No |
| Issue actions | Repository-configured | Yes | No |

Each child task owns the exact schema, routes, API semantics, tests, and real evidence for its platform.

## Data Flow

1. An explicit platform collector reads provider-scoped configuration and an optional environment token.
2. It calls the platform API with bounded pagination/retry behavior.
3. It builds and validates a provider-specific versioned snapshot.
4. An atomic sync replaces only that provider's ignored JSON file under `docs/vitepress/.generated/repository/`.
5. The selected snapshot is resolved by the strict registry into normalized metadata and effective capabilities.
6. Generic theme consumers render only supported data/actions.

## CI, Deployment, and Real Validation

Required provider tests are offline and deterministic: mocked API clients, synthetic snapshot fixtures, validators, and typechecks. The production docs build generates only the selected GitHub snapshot using the workflow token; it never contacts GitLab, Gitee, or Yunxiao. Live validation of those platforms remains a manual acceptance gate because it depends on credentials, quotas, tenant state, and external uptime.

GitHub Actions remains responsible for CI, GitHub Pages, and npm publishing. Supporting another repository host does not imply deploying from that host.

## Execution and Rollback

GitLab is implemented first because it establishes the reusable package boundary. Gitee and Yunxiao then add isolated adapters/clients/snapshots. Production selection stays GitHub throughout, so any unfinished platform can be removed from the registry independently without migrating production data.

