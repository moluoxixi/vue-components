# Vite Config Public Addon Entry Contract

## 1. Scope / Trigger

Apply this contract when changing addon option helpers, their source ownership,
package exports, tsup entries, or public declaration output.

## 2. Signatures

The package exposes the root, aggregate addon entry, and 15 leaf entries:

```text
@moluoxixi/vite-config
@moluoxixi/vite-config/addons
@moluoxixi/vite-config/addons/{auto-import,components,devtools,i18n,layouts,
markdown,pages,pwa,react,tailwindcss,unocss,vite-ssg,vitest,vue,vue-router}
```

Each leaf exports one runtime identity helper and its type-only option contract:

```ts
defineVueAddonOptions(options: VueAddonOptions): VueAddonOptions
```

## 3. Contracts

- Helper implementations live under `src/addons/services`; both source barrels
  are export-only.
- The root, aggregate entry, and matching leaf entry expose the same helper
  function object.
- tsup explicitly maps source services back to `dist/addons/index` and
  `dist/addons/<name>`; internal directory names never leak into public paths.
- The root source condition points to `index.ts`, so the published `files`
  includes both `index.ts` and `src` alongside built JS/declarations.
- Option types come from each installed plugin's public type contract rather
  than local `object` or `Record<string, unknown>` mirrors.

## 4. Validation Matrix

| Condition | Required result |
| --- | --- |
| Import helper from root, aggregate, or leaf | Same helper reference and return identity |
| Import a leaf at runtime | Exactly one runtime helper export |
| TypeScript consumes root or leaf | Resolve the same plugin-native option type |
| Packed consumer imports every non-wildcard entry | Runtime and declaration resolution succeed |
| Source condition is selected | Root `index.ts` and all referenced `src` files exist in tarball |

## 5. Good / Base / Bad Cases

- Good: reorganize source services while preserving explicit build entry names.
- Base: users import all helpers only from the package root.
- Bad: scan a new responsibility directory and emit
  `dist/addons/services/<name>`, or keep forwarding files at old private paths.

## 6. Tests Required

- A table-driven unit test asserts the exact 15 leaf helpers and root/aggregate
  reference identity.
- Type tests cover representative native plugin options and invalid keys.
- Build output retains `dist/index` plus `dist/addons/index` and all 15 leaf
  JS/declaration pairs.
- Packed Node/type smoke validates installed exports.

## 7. Wrong vs Correct

Wrong:

```ts
entry: glob('src/addons/services/*.ts')
```

Correct:

```ts
entry[`addons/${name}`] = `src/addons/services/${name}.ts`
```
