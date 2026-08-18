# Technical Design

## Boundaries

`BaseViteConfigOptions` becomes the common option surface for automatic addons
and raw Vite configuration. `AppViteConfigOptions` is the application
contract and extends the base without application-specific identity fields.
`LibViteConfigOptions` extends the base with `entry`. The two config factories
receive corresponding object-or-function export types.

Sentry is not modeled as an addon. Business plugins use Vite's native
`viteConfig.plugins` field, which already participates in the package's
cross-source plugin merge and override rules.

`pages` is an optional addon in the registry. It uses the native
`vite-plugin-pages` options and defaults to `src/pages` with component and test
exclusions; pure React projects additionally receive `resolver: 'react'` and
`tsx` extensions.

## Library Externalization

Automatic dependency externalization and caller Rollup external rules are
separate inputs. The final predicate returns true when either rule matches.
Supported caller inputs follow Rollup's
`ExternalOption`: string, regular expression, arrays of those values, and
predicate functions. Library dependency externalization is invariant and has no
disable switch.

## Addon Ordering

Features keep registry declaration order when independent. A feature may declare
`dependsOn: AddonName[]`; the registry resolves a stable topological order,
rejecting duplicate names, unknown dependencies, and cycles. `requires` remains
the npm package dependency list and does not express addon ordering.

## Compatibility

Existing valid `createAppConfig` and `createLibConfig` object literals remain
valid. `ViteConfigOptions` and `ViteConfigExport` remain deprecated Library
aliases for source compatibility. The intentional type correction is rejecting
library-only fields passed directly to `createAppConfig`. Runtime plugin
ordering and same-name user override behavior remain unchanged.

## Verification

Use type-level tests for factory boundaries, focused unit tests for every
Rollup external shape, addon dependency ordering, and an application plugin test that
uses a neutral mock rather than importing Sentry.
