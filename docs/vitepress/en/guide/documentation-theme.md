# Documentation Theme and Reuse

The documentation solution keeps VitePress `DefaultTheme` as its layout runtime and composes library-specific route generation, API tables, runnable examples, GitHub metadata, and visual styling on top. This preserves VitePress local search, responsive navigation, page outlines, dark mode, previous/next navigation, and accessibility behavior.

## Adopt it in another component library

1. Copy `docs/vitepress` and replace its component-library workspace dependency in `package.json`.
2. Update `.vitepress/docs-site.ts`. Brand, logo, package name, API entry, style entry, GitHub repository, component source root, public routes, and locale paths are defined there. The theme consumes the target package through the stable `@docs-components` alias, so its Vue imports do not need project-specific edits.
3. Replace `.vitepress/component-manifest.ts` with the new library's public Vue component catalog. The extractor reads `componentEntry` and stops the build when the extracted and documented component sets differ.
4. Optionally author prose and examples in `<componentRoot>/<Component>/docs/index.md` and `index.en.md`. Without prose, the route still renders its title, description, API, changelog, and contributors.
5. Edit messages in `.vitepress/docs-i18n.ts`. `docsLocales` drives VitePress locales, URL prefixes, rewrites, and source documents. A new locale also needs one thin route adapter matching `en/routes/[slug].paths.mts`.
6. Run `pnpm --dir docs/vitepress sync-github-metadata`, then `pnpm --dir docs/vitepress build`.

Normal `dev` and `build` commands remain offline and consume the committed `.vitepress/github-metadata.json`, but first validate repository identity, manifest coverage, component paths, and the snapshot structure. Missing data cannot silently render as zero. The explicit sync command accepts `GITHUB_TOKEN`, pins the configured branch head, follows pagination, excludes pull requests, and only replaces the previous snapshot after a complete successful run.

API names, types, and descriptions remain owned by the extracted source contract instead of being duplicated in Markdown. Theme controls and generated page shells are fully bilingual. Locale source documents and source JSDoc can be translated incrementally by component authors.

## Why the theme still extends DefaultTheme

A full rewrite removes one dependency layer but requires reimplementing search, mobile menus, keyboard navigation, outline synchronization, dark mode, locale switching, and document pagination. This project's customization lives in content generation, API tables, GitHub data, and visual tokens, and DefaultTheme does not constrain those boundaries. The current evaluation therefore keeps DefaultTheme; replacing the layout runtime only makes sense when the product needs a fundamentally different information architecture.
