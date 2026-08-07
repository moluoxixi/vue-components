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
