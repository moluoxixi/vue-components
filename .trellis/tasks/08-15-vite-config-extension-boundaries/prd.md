# Refactor vite-config extension and config boundaries

## Goal

Strengthen `@moluoxixi/vite-config` as a reusable preset without absorbing
application-specific Sentry policy. Make application and library configuration
contracts explicit, and preserve dependency externalization when callers add
their own Rollup rules.

## Requirements

1. Sentry remains caller-owned. The package must not add a Sentry addon,
   dependency, peer dependency, environment-variable convention, release
   policy, or source-map policy.
2. Document and verify that caller-owned build plugins are supplied through
   `viteConfig.plugins` and compose after automatically detected addons.
3. `createAppConfig` must reject the library-only `entry` option at compile
   time. `createLibConfig` must continue accepting `entry`.
4. Library builds must externalize declared dependencies, optional
   dependencies, and peer dependencies even when the caller adds a Rollup
   `external` rule.
5. Preserve existing addon discovery, strict missing-dependency failures,
   plugin override semantics, ESM exports, and existing public names unless a
   compatibility alias is required.
6. Support `vite-plugin-pages` as an optional addon using its native options
   and strict dependency loading. Pages defaults must match the Vue and React
   scaffold contracts.
7. Remove numeric addon ordering. Keep declaration order for independent addons
   and support explicit addon-to-addon dependencies with stable topological
   sorting, unknown-dependency errors, and cycle detection.

## Acceptance Criteria

- [x] No Sentry package or addon is added to source or package metadata.
- [x] README documents caller-owned plugins and shows Sentry only as an
      external consumer example.
- [x] Type tests reject `createAppConfig({ entry: ... })` and accept library
      entry options.
- [x] Library tests prove default and caller external rules are combined for
      functions, strings, regular expressions, and arrays.
- [x] Package typecheck, unit tests, lint, and build pass.
- [x] `vite-plugin-pages` is exported, auto-detected, and covered by
      Vue/React/default-option tests.
- [x] Addon execution no longer depends on numeric `order`; dependency sorting
      and cycle detection are covered by runtime tests.

## Notes

- Vite 6/7 peer-range changes are deferred until an isolated dual-version
  executable matrix exists.
