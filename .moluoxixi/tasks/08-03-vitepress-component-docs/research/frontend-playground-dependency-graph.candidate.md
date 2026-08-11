# Quality Guidelines

> Code quality standards for frontend development.

---

## Scenario: Reusable VitePress Theme Package Boundary

### 1. Scope / Trigger

Apply this contract when a custom VitePress layout is extracted into a reusable workspace or npm package. The theme package owns the layout, global visual system, and theme configuration assembly. Site-specific content components, data generation, and network/filesystem workflows remain consumer-owned.

### 2. Signatures

The package exposes one JavaScript root entry:

```ts
defineElementPlusDocs(options: ElementPlusDocsOptions): UserConfig
createElementPlusDocsTheme(extension?: Partial<Theme>): ElementPlusDocsTheme
elementPlusDocsTheme: ElementPlusDocsTheme
```

The package `exports` map exposes only `"."`; supported helpers and public types are re-exported from that root.

### 3. Contracts

- `defineElementPlusDocs` and the exported theme must be used together. The config factory installs the virtual consumer-style module consumed by the runtime theme.
- The root facade and every static dependency in its browser graph must avoid `node:*`, filesystem/network code, consumer-only workspace packages, and upstream monorepo-internal imports.
- Public options describe only theme-owned behavior: site identity, repository links, locales, routes, search, optional consumer styles/catalog, and controlled VitePress pass-through.
- Consumer capabilities such as API extraction, demos, playgrounds, GitHub synchronization, contributors, or changelogs are registered through `createElementPlusDocsTheme({ enhanceApp })`, Markdown plugins, or Vite plugins. Do not expose no-op feature flags for them.
- Copied upstream source records the repository and fixed commit and ships the complete required license notices. Published JS and CSS artifacts are both scanned for forbidden references and build-marker leakage.
- Each locale keeps its application key, language tag, VitePress site key, and URL prefix distinct. Runtime locale lookup is indexed by the VitePress language tag.

### 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| `site.title` is empty | Throw a field-specific configuration error. |
| `site.defaultLocale` is absent from `site.locales` | Throw an error naming the missing locale entry. |
| Two locales share a `siteKey` or language tag | Throw before VitePress starts. |
| Emitted entry does not load the generated theme CSS | Fail distribution verification. |
| Published JS or CSS contains Node/internal upstream references or the CSS build marker | Fail distribution verification. |
| Consumer needs a site-specific component or plugin | Register it explicitly through the theme extension or VitePress pass-through. |

### 5. Good / Base / Bad Cases

- Good: a component library imports config and theme APIs from the package root, supplies localized nav/sidebar data, and registers its Demo/API components through `enhanceApp`.
- Base: a neutral fixture supplies only site identity and locale data and still builds navigation, sidebar, search, appearance, outline, and NotFound behavior from the built package.
- Bad: the package claims API or GitHub features through booleans but ships no implementation, or the consumer copies the package Layout/CSS to customize one site.

### 6. Tests Required

- Unit: minimal config, missing identity, locale key/language separation, duplicate locale rejection, and isolated consumer-style virtual modules.
- Package: typecheck, unit tests, production build, root-only export assertion, CSS-entry linkage, and forbidden-reference scanning across all JS/CSS artifacts.
- Fixture: production build through package-name imports with the `source` export condition excluded.
- Browser: desktop/mobile navigation, search, outline, appearance, NotFound, accessibility relationships, and horizontal overflow; run consumer integration smoke tests separately.
- Consumer: preserve tests for consumer-owned API, Demo, Playground, metadata, routes, and localization.

### 7. Wrong vs Correct

#### Wrong

```ts
export default {
  extends: DefaultTheme,
  features: { api: true, github: true }, // No implementation ships with the theme.
}
```

#### Correct

```ts
// .vitepress/config.ts
export default defineElementPlusDocs({
  site: { title: 'Component docs' },
  components: { styles: '@scope/components/styles' },
})

// .vitepress/theme/index.ts
export default createElementPlusDocsTheme({
  enhanceApp({ app }) {
    app.component('ApiDocs', ApiDocs)
  },
})
```

The correct form keeps one reusable layout source while making project-specific behavior explicit and testable in the consumer.

## Scenario: External Demo Dependency Projection

### 1. Scope / Trigger

Apply this contract when a documentation demo is exported to CodeSandbox, StackBlitz, or another external package-installed runtime. Dependency collection must follow the component package's built module graph, as in dumi's esbuild asset parser, instead of guessing dependencies from source text in the browser.

### 2. Signatures

The component package exposes generated build metadata:

```ts
interface ComponentPlaygroundEntry {
  dependencies: Readonly<Record<string, string>>
  styleImports: readonly string[]
}

declare const componentPlaygroundManifest:
  Readonly<Record<string, ComponentPlaygroundEntry>>
```

The Markdown build resolves each source variant before serialization:

```ts
resolveExternalProjectSource(context: {
  code: string
  sourceLanguage: 'TS' | 'JS'
  sourceFile: string
  demoId: string
}): ElementPlusDocsExternalProjectSource
```

The browser runtime receives only serializable project data:

```ts
interface ElementPlusDocsExternalProjectSource {
  source: string
  dependencies: Readonly<Record<string, string>>
  styleImports: readonly string[]
}
```

### 3. Contracts

- The component postbuild runs esbuild with `bundle: true`, `metafile: true`, and `packages: 'external'` against every public built entry.
- Manifest keys are public package subpaths. Each entry includes the component package itself and only peer dependencies required by that entry. Normal package dependencies remain transitive through the installed component package.
- Every external package observed in the built graph must exist in the package's `dependencies`, `optionalDependencies`, or `peerDependencies`; an undeclared external aborts manifest generation.
- Markdown build-time parsing uses the Vue SFC parser and TypeScript AST. Root component imports are rewritten to public component subpaths before the external project is serialized.
- TS and generated JS demo variants are resolved independently and embedded as Base64 JSON descriptors.
- Browser code may decode JSON and assemble project files. It must not parse imports, maintain a package-version lookup table, or infer dependencies with regular expressions.
- CodeSandbox and StackBlitz adapters consume the same resolved descriptor so their `package.json`, source, and style imports cannot drift.

### 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Built entry imports an undeclared external package | Fail component postbuild and name the package and entry. |
| Demo imports an unknown component root export | Fail Markdown build with the export and source file. |
| Demo imports an unknown component subpath | Fail Markdown build before VitePress renders the page. |
| Two dependency sources require incompatible versions | Fail generation instead of silently choosing one. |
| Descriptor Base64 or JSON is invalid in the browser | Show the existing external-action error and do not open a provider. |
| Component uses an ordinary dependency such as an icon library | Keep it transitive; do not duplicate it in the sandbox manifest. |

### 5. Good / Base / Bad Cases

- Good: a `CopyText` demo resolves to `@moluoxixi/components/CopyText`, with only `@moluoxixi/components` and `vue` in the external project dependencies, while package styles are included once.
- Base: a self-contained Vue demo with no component entry uses only its directly resolved imports and the external Vue/Vite project defaults.
- Bad: runtime code scans lines matching `import ... from '...'`, maps unknown packages to `latest`, or adds every dependency declared by the component package.

### 6. Tests Required

- Generator: assert every public component subpath has a manifest entry and that undeclared externals and version conflicts fail.
- Markdown: assert root-import rewriting, static imports, re-exports, literal dynamic imports, unknown exports, and TS/JS projections.
- Corpus: parse every real `:::demo` block through the production Markdown demo parser and build both external project variants.
- Provider: assert CodeSandbox and StackBlitz receive identical source dependencies and style imports.
- Browser: on the deployed site, open each real demo's external actions and inspect the generated `package.json`; record console and provider failures.

### 7. Wrong vs Correct

#### Wrong

```ts
const dependency = source.match(/import .+ from ['"](.+)['"]/)
versions[dependency[1]] = hardcodedVersions[dependency[1]] ?? 'latest'
```

#### Correct

```ts
const result = await build({
  entryPoints: [builtEntry],
  bundle: true,
  metafile: true,
  packages: 'external',
  write: false,
})

const externals = Object.values(result.metafile.outputs)
  .flatMap(output => output.imports)
  .filter(item => item.external)
```

The correct form makes the package build graph the source of truth and keeps browser runtime behavior deterministic.
