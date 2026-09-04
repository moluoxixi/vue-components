# Components Public Entry Contract

## 1. Scope / Trigger

Apply this contract when moving a public component, changing feature barrels,
Vue plugin installation, cross-feature imports, Vite entries, auto-loaders,
styles, or playground metadata.

## 2. Signatures

Every public component feature follows this shape:

```text
src/<Feature>/
  index.ts
  components/{index.ts,index.vue,components/?}
  services/{index.ts,component.ts}
  composables/
  types/
  utils/
```

The install service returns one stable object:

```ts
const Component = withInstall(ComponentSource)
export { Component }
export default Component
```

## 3. Contracts

- Feature and responsibility `index.ts` files contain exports only. The main
  SFC lives at `components/index.vue`; a child with one parent lives under
  `components/components`.
- `services/component.ts` is the only owner of `withInstall` composition. The
  root export, leaf named export, leaf default export, and component registered
  by `app.use()` are the same object.
- Cross-feature production imports use `#components/<Feature>` or the target
  feature barrel. Private SFC/type paths and three-level relative imports are
  forbidden; the path-contract exception list remains empty.
- The canonical public component set contains ConfigTable, CopyText,
  DateRangePicker, EnterNextContainer, HeadlessCopyText, HeadlessTable,
  PopoverTableSelect, RequestCascader, RequestSelectV2, and RequestTreeSelect.
- Package exports, Vite entries, `componentNames`, generated playground
  manifest, and packed-browser allowlist remain synchronized with that set.
- `./styles` remains the single aggregate CSS entry and auto-component results
  declare it as a side effect.
- HeadlessTable renderer registry, injection key, app plugin, normalization,
  and resolution live in `HeadlessTable/services/renderer.ts`; ConfigTable
  consumes only the HeadlessTable feature API.

## 4. Validation Matrix

| Condition | Required result |
| --- | --- |
| Import component from root or leaf | Same installable component object |
| Import leaf default and named values | Strict reference identity |
| `app.use(component)` | Register component by its stable feature name |
| Public component added or removed | Update exports, build, loader, manifest, tests, and docs atomically |
| Cross-feature implementation import | Reject unless it uses the private package import or feature barrel |
| Renderer exists in local map and registry | Local map wins; registry remains reactive |
| App provides a renderer registry | Provided registry wins over global singleton |

## 5. Good / Base / Bad Cases

- Good: `CopyText` imports `HeadlessCopyText` through
  `#components/HeadlessCopyText` and keeps its own types beside the feature.
- Base: a simple component has only components, services, types, and tests.
- Bad: import `../OtherFeature/src/index.vue`, keep `withInstall` logic in a
  feature barrel, or create a second component list for build tooling.

## 6. Tests Required

- Public-entry tests cover all 10 root/leaf/default/named/install identities.
- Auto-loader tests derive public names from package exports and verify every
  resolver side effect plus runtime auto-import subpath.
- Component unit tests retain behavior coverage; HeadlessTable and ConfigTable
  cover renderer precedence, reactive registry changes, injection, and plugin
  use.
- Build regenerates exactly 10 playground entries and stable JS/declaration
  subpaths. Playground E2E and packed browser smoke load the aggregate styles.
- Package architecture and path contracts report zero Components debt and zero
  deep-import exceptions.

## 7. Wrong vs Correct

Wrong:

```ts
import OtherSource from '../OtherFeature/src/index.vue'
export const Current = withInstall(CurrentSource)
```

Correct:

```ts
// component implementation
import Other from '#components/OtherFeature'

// feature index.ts
export { Current, default } from './services'
```
