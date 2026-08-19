# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

Quality gates must verify public behavior at the narrowest useful layer and then protect package and browser boundaries in proportion to risk. Shared composables receive direct tests; component adapters receive rendering/event tests; publishable entrypoints receive packed-consumer checks.

---

## Forbidden Patterns

- Do not rely only on wrapper component tests for a shared composable's contract.
- Do not use array position as persistent UI-state identity.
- Do not synchronize browser tests with fixed sleeps when an observable state contract exists.
- Do not validate public package imports only against workspace source aliases.
- Do not import every publishable entry into a browser automatically; use an explicit browser-capable allowlist so Node/server/tooling entries remain out of browser graphs.
- Do not use a consumer-owned alias such as `@/` inside source that other workspace packages compile through a `source` condition.
- Do not locate workspace tooling from package lifecycle scripts with depth-sensitive paths such as `../../../scripts/tool.mjs`.

---

## Required Patterns

- Test resolution and cleanup rules as pure/composable behavior before component integration.
- Test typed event payloads and no-op behavior at the emitting component boundary. Single events assert `scope`, `action`, `mode`, `previousMode`, and applicable `rowId`/`columnId`; bulk events assert `scope`, `action: 'clearAll'`, `cleared`, and `mode`.
- Keep release helper discovery and source-generation logic side-effect free and directly testable.
- Verify packed tarballs in an isolated consumer before publication.
- Use Vite and Chromium for browser-capable packed JS/CSS entrypoints, and keep Node runtime/type smoke for the complete publishable package set.
- Use package-owned `imports` specifiers for ordinary cross-module implementation imports inside source-published packages. Keep Vue SFC macro type contracts relative when the macro resolver cannot consume the private import map.
- Pass an explicit package manifest to workspace-root lifecycle tools so package identity does not depend on the caller's directory depth.

---

## Scenario: Editable Table Regression Coverage

### 1. Scope / Trigger

Apply when table rendering varies by global, row, or cell mode, or when mode state is exposed through public component APIs and events.

### 2. Signatures

```ts
type EffectiveMode = 'default' | 'edit'

interface ModeTestHarness {
  setPropMode(mode?: EffectiveMode): Promise<void>
  reorderRows(ids: Array<string | number>): Promise<void>
  getCellText(rowId: string | number, columnId: string): string
  emittedModeChanges(): unknown[]
}
```

### 3. Contracts

- Unit tests own precedence, clear, no-op, and bulk-count semantics.
- Component tests own slot selection, exposed API wiring, and emitted payloads.
- Identity tests mutate ordering/filtering/pagination after overrides are set and locate results by stable row id.
- Documentation and public type exports are part of the consumer contract.

### 4. Validation & Error Matrix

| Case | Assertion point |
| --- | --- |
| Cell, row, global, and prop values disagree | Cell wins |
| Cell override clears | Row becomes effective |
| Row override clears | Global API override, then prop, becomes effective |
| Bulk row clear with cell overrides present | Row count is reported once; cells remain |
| Bulk cell clear with row overrides present | Cell count is reported once; rows remain |
| Repeated set/clear with no state change | No additional `modeChange` event |
| Rows reorder after override | Override stays on the same stable id |
| Edit slot absent | Default renderer output is unchanged |

### 5. Good/Base/Bad Cases

- Good: a direct composable test proves the precedence matrix, while component tests prove edit-slot output and event forwarding.
- Base: unchanged consumers have a regression asserting their original default rendering.
- Bad: asserting only that internal Maps changed, or locating a reordered row by its old array index.

### 6. Tests Required

- Direct composable tests for `set*`, `clear*`, `clearAll*`, getters, precedence, prop fallback, and no-op notifications.
- Headless and UI-adapter tests for inline/named edit slots, default fallback, exposed APIs, and event forwarding.
- Stable-id regression through reorder plus at least one filter or pagination boundary when the adapter supports it.
- Public export/typecheck coverage for event, expose, slot-scope, and mode API types.
- Bilingual documentation checks or review for public APIs when both locales are maintained.

### 7. Wrong vs Correct

#### Wrong

```ts
expect(wrapper.vm.rowModes.get(0)).toBe('edit')
await new Promise(resolve => setTimeout(resolve, 300))
```

#### Correct

```ts
modeApi.setRowMode('account-42', 'edit')
await wrapper.setProps({ rows: reorderedRows })
expect(cellFor('account-42', 'name').text()).toBe('editing')
await expect(input).toHaveAttribute('aria-expanded', 'false')
```

---

## Scenario: Packed Browser Consumer Verification

### 1. Scope / Trigger

Apply when a publishable package adds or changes browser JavaScript subpaths, CSS exports, compatibility entrypoints, or peer/runtime package boundaries.

### 2. Signatures

```text
pnpm test:pack
pnpm test:pack:browser
```

The browser verifier owns explicit JavaScript and stylesheet allowlists. Discovery helpers accept package manifests and return public specifiers without filesystem or subprocess side effects.

### 3. Contracts

- `test:pack` packs every publishable package and verifies package metadata, root Node imports, public typed entry resolution, and consumer typechecking.
- `test:pack:browser` installs packed tarballs into an isolated consumer, builds allowlisted browser entries with Vite, loads the output in Chromium, and checks runtime and CSS markers.
- CSS discovery supports string exports and object exports with an `import` stylesheet target; wildcard styles are excluded from static smoke imports.
- Browser allowlists must be deliberate. Node built-ins, Vite plugins, server entries, and build configuration packages are not browser candidates.

### 4. Validation & Error Matrix

| Failure | Required result |
| --- | --- |
| Allowlisted package is not publishable | Fail before source generation |
| Allowlisted subpath is no longer exported | Fail with the public specifier named |
| Vite cannot resolve a packed entry | Fail the build |
| Browser module throws during evaluation | Capture `pageerror` and fail |
| Expected CSS selector/variable is missing | Fail the named style assertion |
| Chromium is unavailable | Fail with Playwright launch diagnostics |

### 5. Good/Base/Bad Cases

- Good: fast manifest helper tests cover discovery edge cases, then one packed Vite/Chromium smoke covers the actual publish boundary.
- Base: ordinary `test:pack` keeps its Node and TypeScript semantics unchanged.
- Bad: importing workspace source aliases, checking only that CSS files exist in `dist`, or sending Node-only exports through Vite.

### 6. Tests Required

- Root (`.`) and subpath public-specifier mapping.
- Typed JavaScript discovery with missing/malformed export conditions.
- String and `import`-condition CSS discovery plus wildcard exclusion.
- Allowlist drift diagnostics and generated browser-source assertions.
- CI contract asserting Chromium installation precedes `test:pack:browser` and workspace packages are built first.
- A real packed consumer Vite build, Chromium runtime marker, browser error collection, and stable CSS selector/variable checks.

### 7. Wrong vs Correct

#### Wrong

```ts
for (const packageName of allPublishablePackages)
  browserImports.push(packageName)
```

#### Correct

```ts
const browserEntries = {
  '@moluoxixi/components': [
    '.', './auto-loaders', './playground-manifest', './AntdConfigForm',
    './ConfigTable', './CopyText', './DateRangePicker', './ElementConfigForm',
    './EnterNextContainer', './HeadlessCopyText', './HeadlessTable',
    './PopoverTableSelect', './RequestCascader', './RequestSelectV2',
    './RequestTreeSelect', './RichTextEditor', './configForm', './element', './antd',
  ],
  '@moluoxixi/rich-text-editor': ['.'],
  '@moluoxixi/vitepress-theme-element-plus': ['./repl'],
}

const browserStyles = {
  '@moluoxixi/components': ['./styles'],
  '@moluoxixi/rich-text-editor': ['./styles'],
  '@moluoxixi/vitepress-theme-element-plus': ['./repl.css'],
}
```

---

## Scenario: Package-Owned Internal Paths and Lifecycle Tools

### 1. Scope / Trigger

Apply when a workspace package is compiled directly by other packages through a `source` condition, uses cross-module internal imports, or runs a repository-root tool from `postbuild`/`prepack`.

### 2. Signatures

```text
pnpm -w finalize:declarations --manifest "$npm_package_json"
node scripts/finalize-published-declarations.mjs --manifest <absolute-package-json>
pnpm test:path-contracts
```

```json
{
  "imports": {
    "#components/*": {
      "source": "./src/*/index.ts",
      "types": "./dist/src/*/index.d.ts",
      "default": "./src/*/index.ts"
    }
  }
}
```

### 3. Contracts

- The lifecycle command receives the calling package's `npm_package_json`; the root tool derives both `packageRoot` and the manifest it validates from that explicit path.
- `pnpm-workspace.yaml` enables `shellEmulator` so the lifecycle variable expands consistently in supported Windows and POSIX environments.
- Private import names start with `#`, are owned by the nearest package manifest, and cannot be rebound by a consuming application's Vite or TypeScript alias.
- `source` maps monorepo direct compilation to package source, `types` maps published type consumers to emitted declarations, and `default` supports development/test resolvers without the custom `source` condition.
- Vue SFC macro-facing `types/` modules may retain reviewed relative imports when `defineProps`, `defineEmits`, or `defineSlots` must recursively resolve imported types.

### 4. Validation & Error Matrix

| Failure | Required result |
| --- | --- |
| `--manifest` missing or empty | Fail with the exact command usage |
| Manifest points to the wrong package | Validate that package and fail its missing/invalid `dist` contract; never fall back to workspace cwd |
| Package moves to another directory depth | No lifecycle script change required |
| Consumer defines its own `@` alias | Package-private `#...` resolution remains unchanged |
| Private specifier lacks a matching import-map target | Typecheck/build fails before publication |
| Private specifier remains in emitted declarations | Packed NodeNext consumer must resolve it through the package `imports.types` target |
| Vue SFC macro cannot expand a private import | Keep that reviewed type-contract import relative; do not use `@vue-ignore` to hide runtime props |

### 5. Good/Base/Bad Cases

- Good: a component implementation imports `#components/HeadlessTable`, and a playground with an unrelated `@` alias typechecks the source package.
- Base: local sibling imports such as `../types` remain relative because they are already readable and package-local.
- Bad: a package script calls `node ../../../scripts/finalize-published-declarations.mjs`, or source-published library code imports `@/HeadlessTable` and silently resolves against the playground's `@` alias.

### 6. Tests Required

- Invoke the root finalizer as a real process: missing `--manifest` must fail with the usage contract, and an explicit manifest must select the same package from an unrelated cwd.
- Maintain an explicit reviewed list of packages that require declaration finalization; assert each uses the root command and explicit manifest argument.
- Parse TypeScript/Vue module specifiers structurally and compare remaining deep relative imports with an explicit reviewed exception list.
- Run package build and the direct-source consumer typecheck.
- Run a forced all-package build to execute every lifecycle command without cache.
- Pack all publishable packages and run NodeNext type consumption so private import mappings are checked from tarballs.
- Scan emitted JavaScript for unresolved private aliases; private aliases in declarations are allowed only when the packed type consumer resolves them.

### 7. Wrong vs Correct

#### Wrong

```json
{
  "postbuild": "node ../../../scripts/finalize-published-declarations.mjs"
}
```

```ts
import { ConfigTable } from '@/ConfigTable'
```

#### Correct

```json
{
  "postbuild": "pnpm -w finalize:declarations --manifest \"$npm_package_json\"",
  "imports": {
    "#components/*": {
      "source": "./src/*/index.ts",
      "types": "./dist/src/*/index.d.ts",
      "default": "./src/*/index.ts"
    }
  }
}
```

```ts
import { ConfigTable } from '#components/ConfigTable'
```

---

## Code Review Checklist

- Does state use stable domain identity?
- Are shared helpers directly tested?
- Do no-op and error paths have assertions?
- Are public types, docs, manifests, and implementation aligned?
- Does browser coverage exercise packed artifacts rather than workspace aliases?
- Are Node/server entries excluded from browser allowlists?
- Are cross-module internal imports owned by the source package rather than by a consumer alias?
- Do package lifecycle tools receive an explicit manifest instead of deriving package identity from relative depth or cwd?
