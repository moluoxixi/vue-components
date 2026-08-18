# Implementation Plan

1. Split common, application, and library option/export types while retaining
   the existing `ViteConfigOptions` and `ViteConfigExport` names as deprecated
   Library compatibility aliases.
2. Normalize Rollup external rules and combine them with automatic dependency
   externalization without a disable switch.
3. Add behavior and type tests, including a caller-owned plugin case that does
   not import Sentry.
4. Remove numeric addon ordering and add stable dependency-based feature sorting.
5. Update README and design contract wording.
6. Run package typecheck, test, lint, and build; inspect package exports and the
   final diff.
7. Add `vite-plugin-pages` optional peer/dev metadata, a registry feature,
   native option helper, and scaffold-compatible tests.

## Rollback

If Rollup external normalization changes unsupported third-party behavior,
revert the combination helper and keep only the type split/documentation. Do
not weaken dependency externalization silently.

## Completed

- Split base, application, and library option/export types while retaining the
  deprecated interface-shaped compatibility surface.
- Kept business plugins caller-owned through `viteConfig.plugins`; no Sentry
  source, addon, peer, or package dependency was added.
- Combined invariant library dependency externalization with every supported
  caller Rollup external shape.
- Tightened base/addon helpers to reject Library-only fields.
- Removed the premature `appName` / `appCode` application identity surface.
- Replaced numeric addon `order` with stable `dependsOn` topological sorting,
  including unknown-dependency and cycle errors.
- Added regression tests and updated package README/design contracts.
- Added the `pages` addon with optional peer metadata, a native option helper,
  and Vue/React page defaults.

## Validation Results

- `pnpm typecheck`: passed.
- `pnpm test`: passed, 8 files and 62 tests.
- Targeted ESLint for all changed package files: passed.
- `pnpm --filter @moluoxixi/vite-config build`: passed, including declarations.
- `publint packages/vite-config`: passed with no findings.
- `git diff --check`: passed.

## Knowledge Proposals

- Current: `20260815111443-type-safety-5849db` supersedes the pages/html
  proposal and documents pages-only support plus dependency-based ordering.
- Superseded: `20260815095258-type-safety-2a4c84` removed the interim identity
  contract and documented pages/html plus dependency-based addon ordering.
- Superseded: `20260815090916-type-safety-659adb` documented the interim
  App-only identity contract and pages/html addon contracts.
- Superseded: `20260815081342-type-safety-4f9f3f` documented the earlier
  invariant externalization and App-only identity contract.
- Superseded: `20260815074917-type-safety-53b8f8` contains the removed
  `externalizeDependencies` option and should be rejected during explicit
  `spec-review`.
