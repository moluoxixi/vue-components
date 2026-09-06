# Vite Config Addon Runtime Contract

## 1. Scope / Trigger

Apply this contract when changing addon dependency detection, inspection,
registry order, dynamic plugin loading, default option merging, or App/Library
config composition.

## 2. Signatures

```ts
inspectViteFeatures(options?: BaseViteConfigOptions): ViteFeatureInspectionResult
getBaseConfig(options?: BaseViteConfigOptions): Promise<UserConfig>
createAppConfig(config?: AppViteConfigExport): UserConfigExport
createLibConfig(config?: LibViteConfigExport): UserConfigExport

interface ViteFeature<TOptions, TState> {
  name: AddonName
  dependsOn?: AddonName[]
  triggers: string[]
  requires?: string[]
  createState?: (ctx: AddonContext, options?: TOptions) => TState
  setup: (ctx: AddonContext, options: TOptions | undefined, state: TState) => UserConfig | Promise<UserConfig>
}

`AddonContext` exposes both dependency detection and resolved feature state:

```ts
hasAddonDep(name: string): boolean
isFeatureEnabled(name: AddonName): boolean
```
```

## 3. Contracts

- `createAddonContext` is the only Node adapter for dependency detection and
  dynamic imports. It resolves from `viteConfig.root`, uses the target
  `package.json`, and requests `node` plus `import` export conditions.
- Enablement precedence is explicit `false`, explicit `true` or payload,
  detected trigger, then disabled. Inspection never imports plugin modules.
- Concrete registry order is Vue, React, UnoCSS, Tailwind, Vue Router, Vue
  Layouts, Auto Import, Components, Pages, I18n, Devtools, PWA, Markdown,
  Vitest, and Vite SSG.
- `dependsOn` is a stable topological dependency; independent features retain
  declaration order. `requires` validates npm packages and is not an ordering
  mechanism.
- `mergeAddonOptions` keeps caller arrays first, removes duplicate references,
  and fills nested defaults. `mergeConfigWithUserPlugins` lets caller plugins
  replace generated plugins only when their non-empty `name` matches.
- Library externalization covers dependencies, optional dependencies, peer
  dependencies, and their subpaths, then unions the caller external rule.
- Cross-addon defaults use `isFeatureEnabled`; package detection remains for
  module availability and optional runtime enhancements. Explicitly disabled
  framework addons must not leak into another addon’s generated defaults.
- The `vitest` feature has no dependency trigger and is configured only when
  explicitly enabled, so a Vitest devDependency cannot add `test` to App/Lib
  build configuration automatically.

## 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Explicit addon value is `false` | Disabled even when a trigger exists |
| Framework addon is explicitly disabled while another addon is enabled | Dependent defaults observe the disabled feature state |
| Explicit addon value is `true`, object, or supported string | Enabled, then validate `requires` |
| Required package is absent | Throw `[ViteConfig] <owner> requires missing package(s)` with checked root |
| Dynamic import fails | Clear its cache entry and throw owner/specifier/root context with `cause` |
| Feature name is duplicated | Throw `duplicate addon feature` |
| Dependency is unknown or cyclic | Throw `depends on unknown addon` or `circular addon dependency` |
| Enabled dependency feature is disabled | Throw `requires enabled addon(s)` |
| Plugin module lacks a default factory | Throw the existing `expected ... default plugin factory` TypeError |

## 5. Good / Base / Bad Cases

- Good: a monorepo app passes its root and receives the plugin version installed
  for that app, including conditional subpath exports.
- Base: no addon dependencies are declared, so base config contains only the
  stable source alias and no plugins.
- Bad: use a bare dynamic import resolved from this package, reorder registry
  entries during a directory move, or replace merge behavior with object spread.

## 6. Tests Required

- Runtime tests cover bare/scoped package parsing, consumer-root and subpath
  resolution, error wrapping, ordering, cycles, missing dependencies, and
  inspection without imports.
- Concrete registry tests assert every name, trigger, requirement, dependency,
  and order.
- Feature matrix tests cover all plugin/config fragments and caller merge
  precedence; real fixture tests cover App, Library, Vue, React, CSS, Markdown,
  Pages, Layouts, and SSG configurations.
- Package coverage, typecheck, build, and browser fixtures run after ownership
  changes.
- Trigger tests distinguish runtime framework packages from compiler plugin
  packages; a runtime-only manifest stays inspection-disabled until the caller
  explicitly enables the compiler addon.

## 7. Wrong vs Correct

Wrong:

```ts
const plugin = await import(specifier)
```

Correct:

```ts
const resolved = rootRequire.resolve(specifier, {
  conditions: new Set(['node', 'import']),
})
const plugin = await import(pathToFileURL(resolved).href)
```
