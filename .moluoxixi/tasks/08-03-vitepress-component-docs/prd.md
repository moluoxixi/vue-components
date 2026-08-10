# VitePress component documentation

## Goal

Deliver a production-ready component-library documentation site whose navigation, component pages, examples, API tables, and visual language closely match the Element Plus documentation experience.

## Background

- The repository already contains an uncommitted VitePress site and 11 component documentation pages. These changes must be preserved and completed rather than replaced wholesale.
- `packages/ai-doc-assistant` extracts 13 public Vue component contracts from `packages/components/index.ts`.
- Documentation coverage follows the public component entry: every public Vue component must have a route and generated API documentation, even when a handwritten demo is not yet available.

## Requirements

- R1: Use a custom VitePress theme with an information-dense, restrained visual treatment highly similar to Element Plus documentation.
- R2: Make the overview the main route and first screen. It must provide direct access to all 13 public components.
- R3: Generate props, emits, expose, and slots API data from `packages/ai-doc-assistant`; do not maintain those contracts by hand in Markdown.
- R4: Author and maintain component explanations and runnable example code manually. API rendering must remain independent from example availability; components without a demo still receive a complete API page.
- R5: Show complete or expanded type information in an accessible tooltip that works with pointer, keyboard, and touch interaction.
- R6: Preserve local search, sidebar navigation, previous/next links, dark mode, responsive layout, and code-copy/source-toggle interactions.
- R7: Correct known documentation/runtime defects: missing assets, non-running dayjs demo, wrong ConfigTable response contract/defaults, wrong PopoverTableSelect prop values, API extraction false-green behavior, and mobile overflow.
- R8: Verify the built site in a real browser, including the overview, representative component pages, dynamic demos, tooltips, desktop/mobile layouts, and console errors.
- R9: Sync repository metadata from GitHub into a committed offline snapshot. Show the real open issue count, component-scoped contributors, and every commit that touched the current component.
- R10: Add a component changelog action in the fixed page metadata and show the component-scoped commit timeline in an accessible dialog; keep generated API documentation and component contributors as the invariant page footer.
- R11: Support `zh-CN` and `en-US` for generated routes, navigation, and custom-theme UI. Handwritten component prose may be translated incrementally through locale-specific source documents.
- R12: Keep the documentation solution fast to adopt in another component library by centralizing repository, package, source-path, route, locale, and GitHub-sync settings.
- R13: Evaluate a full replacement of VitePress DefaultTheme. Retain it unless a replacement demonstrably improves reuse without regressing search, navigation, responsive behavior, dark mode, or accessibility.
- R14: Make repository quality gates truthful for the documentation work: root lint must not be dominated by managed Moluoxixi/Codex output, and type checking must cover the docs package plus package-level test suites that are currently omitted by incorrect or incomplete tsconfig includes.
- R15: Add an Element Plus-style "edit in playground" action to every runnable demo. The action opens a dedicated, lazily loaded playground with a single Vue SFC editor, manual run, reset, copy, preview, and structured compile/runtime errors.
- R16: Reuse one hardened SFC compilation boundary for static demos and the playground. It must allow only configured modules, reject unknown files/imports, use unique virtual filenames, clean injected styles on success, failure, rerun, and unmount, and ignore stale async compile results.
- R17: Keep playground source out of shareable URLs in the first release. Transfer the trusted demo source through an ephemeral same-origin session and provide a safe starter when the playground is opened directly.
- R18: Publish reusable `autoComponent` and `autoImport` integrations for `unplugin-vue-components` and `unplugin-auto-import` from an isolated `@moluoxixi/components/auto-loaders` subpath, with component styles and runtime helper names maintained from one package-owned manifest. The root component entry must not re-export the loaders, and the VitePress host and component playground must consume the subpath themselves.
- R19: Keep every browser-compiled documentation demo self-contained by requiring explicit imports for component-library and Element Plus components, and reject example regressions that would render as unresolved custom elements.
- R20: Extend ConfigTable with the shared HeadlessTable renderer contract, named Vue slots, stable column ordering and visibility state, plus an opt-in accessible column-settings dialog with drag, keyboard reordering, and show/hide controls.
- R21: Make named table renderers easy to register once per Vue application and reuse across ConfigTable and HeadlessTable instances. Extend ConfigTable column settings with controlled width state and UI, and keep its Element Plus pagination localized, responsive, and protected from conflicting passthrough state.
- R22: Keep Element Plus table and pagination roots free from internal layout classes. Split large component implementations and public contracts by responsibility while preserving one component entry and generated API accuracy.
- R23: Move the reusable overview home, searchable component catalog, component metadata, changelog timeline, contributor list, and issue actions into `@moluoxixi/vitepress-theme-element-plus`. The theme package owns their UI, interaction, accessibility, responsive behavior, styles, public types, and integration factory; a consuming documentation site supplies only normalized catalog, locale, repository-link, and metadata data.
- R24: Remove the migrated consumer component files, duplicate style rules, and every directory left empty by the migration. Preserve consumer-owned API extraction, GitHub synchronization/snapshot validation, component manifests, and repository credentials outside the browser theme dependency graph.
- R25: Move the reusable Demo Markdown plugin, SFC compiler boundary, playground session/runtime, Playground UI, and generated API document UI into `@moluoxixi/vitepress-theme-element-plus`. Consumers supply only their allowed runtime modules, starter source, playground route, generated API records, and localized messages.
- R26: Publish a browser-safe `@moluoxixi/ai-doc-assistant/api-contract` entry for normalized API-document types and contract normalization. Keep Node extraction, TypeScript-based type-detail expansion, JSON discovery, route generation, and filesystem output in the consuming documentation build.
- R27: Make every generated component route discoverable through VitePress local search. Search must match canonical component names, locale labels, and useful family aliases such as `ConfigForm`, independent of input case.
- R28: Upgrade the reusable Demo source toolbar to match the Element Plus documentation pattern: preserve collapsible source display, provide a persisted TS/JS switch, derive JavaScript from the TypeScript Vue SFC at build time, and keep copy/playground actions synchronized with the selected source.
- R29: Allow a consuming documentation site to attach an optional GitHub source link to each Demo. The link must target the original Markdown demo fence lines when that source information is available; repository identity, branch/ref, source path, and URL construction remain consumer-owned.
- R30: Build the documentation site, components playground, and ConfigForm playground as one deterministic GitHub Pages artifact. Every application must use its deployed project-page base path instead of assuming the domain root.
- R31: Deploy GitHub Pages from `main` only after the repository quality gate passes. Pull requests must still build and validate the complete Pages artifact without receiving deployment or release permissions.
- R32: Publish public workspace packages through the existing Changesets flow only after verification succeeds, with npm provenance, branch restrictions, serialized publication, and job-scoped least-privilege permissions.

## Acceptance Criteria

- [x] `/` is the overview and visibly lists all 13 public components above a usable continuation of the page.
- [x] Theme, navigation, sidebar, demo blocks, API tables, typography, spacing, and colors form a coherent Element Plus-like documentation experience on desktop and mobile.
- [x] `pnpm --filter @moluoxixi/docs extract-api` uses `packages/ai-doc-assistant`, writes deterministic contract data, and exits non-zero when required components cannot be extracted.
- [x] Every component page consumes generated API data for props, emits, expose, and slots, with empty sections omitted.
- [x] Long/custom types have discoverable details via hover/focus/tap tooltip behavior.
- [x] All 13 public components have generated API pages; the existing 11 demo-bearing pages continue to render without compilation errors.
- [x] Static assets render without 404s and component demos remain scrollable/usable at narrow widths.
- [x] Relevant tests/type checks pass, VitePress production build succeeds, and browser smoke checks show no blocking console/page errors.
- [x] Open issue counts, contributor avatars, contributor names, and commit timelines come from a validated GitHub snapshot and are scoped to the current component.
- [x] Every component page opens its changelog from the fixed header metadata in an accessible dialog, including commit message, SHA, author, date, and GitHub URL; API documentation and contributors remain fixed footer content.
- [x] Chinese and English locale routes build successfully, and all custom-theme controls use locale messages.
- [x] Repository-specific values are isolated in one reusable documentation configuration module.
- [x] Root lint reports actionable project findings without traversing managed workflow/runtime output, and the scoped business lint passes.
- [x] Root type checking covers `docs/vitepress` and the previously omitted package test suites; all newly covered TypeScript errors are resolved.
- [x] Every runnable Demo exposes a keyboard-accessible playground action that opens a dedicated editor without adding the editor implementation to ordinary component-page bundles.
- [x] The playground can run, reset, and copy one Vue SFC, reports compile and runtime failures, remains usable at desktop/mobile widths, and does not auto-run source supplied through the URL.
- [x] Static demos and repeated playground runs do not reuse stale modules or leak styles, and focused unit/browser tests cover those failure paths.
- [x] Consumers can enable package-owned automatic component/style resolution and runtime helper imports; the VitePress host and component playground both verify the paths without representative explicit imports.
- [x] Every browser-compiled Vue demo imports its runtime components explicitly and renders without unresolved-component warnings.
- [x] ConfigTable supports local/registered cell and header renderers, preserves slot and formatter precedence, and keeps existing value/index semantics compatible.
- [x] ConfigTable column settings can reorder and show/hide stable columns by drag or keyboard without mutating the caller's `columns` array.
- [x] One application-level renderer plugin can serve multiple ConfigTable/HeadlessTable instances while per-table renderers remain a compatible override.
- [x] ConfigTable exposes controlled column width state and its dialog can edit, reset, and apply order, width, and visibility without mutating source columns.
- [x] ConfigTable pagination remains Element Plus based, follows the documentation locale, does not allow passthrough props to override controlled page state, and remains usable at narrow widths.
- [x] ConfigTable applies responsive layout only through package-owned wrappers, not through classes or CSS overrides on the ElTableV2 and ElPagination roots.
- [x] ConfigTable logic and ConfigTable/RichTextEditor contracts are split into focused modules behind their existing public entry points, with props, emits, slots, and expose extraction unchanged.
- [x] A new documentation consumer can enable the overview, searchable catalog, component metadata, changelog, contributors, and issue actions through the theme package public API without copying their Vue components or CSS.
- [x] The current documentation site supplies normalized project data to the theme content integration, retains its existing Markdown component names and behavior, and no longer contains duplicate catalog/component-meta implementations or empty migration directories.
- [x] A new documentation consumer can enable Demo, Playground, and ApiDocs through package public APIs without copying Vue components, the SFC compiler, session utilities, or the Markdown demo plugin.
- [x] API JSON uses the browser-safe ai-doc contract entry, the theme renders normalized contracts without importing Node extraction code, and the current consumer contains only project-specific runtime/API adapters with no empty migration directories.
- [x] Local search returns generated component routes for canonical names and family aliases, including a case-insensitive `configForm` query.
- [x] Demo source can be expanded/collapsed and switched between TS and generated JS; copy and playground use the selected variant, and the preference survives navigation.
- [x] Demo source links open the corresponding GitHub Markdown fence line range without adding repository-specific configuration to the theme package.
- [ ] GitHub Actions builds one Pages artifact containing the VitePress site plus both standalone playgrounds, with correct project-page asset URLs and all expected HTML entry points.
- [ ] Successful `main` builds deploy the Pages artifact while pull requests perform the same build validation without deployment credentials.
- [ ] Changesets can create a version PR or publish packages from verified `main` revisions with npm provenance; no unverified or non-main workflow run can publish.

## Out Of Scope

- Custom-domain provisioning and DNS management.
- Documenting standalone ConfigForm adapter packages that are not exported by `@moluoxixi/components`.
- Reworking `packages/ai-doc-assistant` features beyond what is required to consume its existing public contract output.
- Runtime API changes unrelated to the requested ConfigTable renderer and column-settings feature.
- Arbitrary npm installation, relative multi-file imports, preprocessors, asset files, collaborative editing, persistence, and source-sharing URLs in the playground.
