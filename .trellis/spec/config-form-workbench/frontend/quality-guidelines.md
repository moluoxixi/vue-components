# ConfigForm Workbench Quality Contracts

These contracts apply to `packages/ConfigForm/workbench`. Read them before
changing Monaco language services, dialog focus behavior, or accessibility
gates.

## Workbench Stylesheet Ownership

- `src/styles/index.css` is the synchronous cascade manifest used by the main
  Workbench entry. It imports styles only and keeps `responsive.css` last.
- A feature or component selector family lives beside its owner under
  `style/index.css`. `src/styles/` keeps only shell/studio/responsive and truly
  cross-feature surface rules; it must not become a second home for dialogs,
  template catalog, JSON import, or notification CSS.
- Mixed selector rules are split by owner without changing declarations or
  specificity. Async Vue loading must not become the trigger for critical
  dialog/workspace CSS, because it can produce an unstyled first frame.
- `PreviewRuntimeHostFrame` is an iframe boundary. Parent Workbench styles may
  size the iframe element but cannot target Runtime descendants inside it.

Required regression coverage composes every owner stylesheet in exact cascade
order, rejects removed aggregate/orphan selectors, checks representative
include/exclude families, builds both Workbench entries, and runs desktop,
tablet, and mobile visual baselines.

---

## Monaco Vue SFC Language Services

The workbench keeps the visible `src/App.vue` model on the `vue` language so template HTML, folding, and embedded
tokenization remain available. TypeScript semantics for `<script>` blocks use a hidden `typescript` mirror whose length and
line breaks exactly match the SFC; all non-script characters are replaced with spaces. This makes TypeScript worker offsets
safe to map directly back to the visible Vue model.

Required contracts:

- `MonacoEnvironment.getWorker(..., 'vue')` must return the bundled HTML worker because the custom Vue HTML language
  service creates its worker with the `vue` label.
- Vue script completion and Hover must query Monaco's TypeScript worker and the shared workbench declarations. A global
  mixed Vue/ConfigForm completion list is forbidden because it leaks exports across named-import modules.
- TypeScript Config semantic completion and Hover belong to Monaco's built-in TypeScript provider. The custom provider
  is limited to ConfigForm snippets and project-manifest module paths that have no ambient declaration; it must not
  duplicate worker exports or signatures.
- Module-path completion may use the explicit workbench module allowlist for Vue/Config fallback, plus package names from
  the current project manifest. Named-import completion must come from the declaration for the statement's actual module.
- Installing the workbench worker router must preserve an existing `MonacoEnvironment` and delegate unknown labels to its
  previous `getWorker`; TypeScript entries are de-duplicated before they are mapped to Monaco suggestions.
- If modular loading misses Monaco's one-shot TypeScript language event, initialize the pinned Monaco `tsMode` with
  `typescriptDefaults` before retrying `getTypeScriptWorker()`.
- Mirror content must update with the SFC model and be disposed with it.
- Every language used by an embedded SFC region must load its Monaco basic-language contribution explicitly;
  language-service workers provide diagnostics and semantic features but do not provide syntax tokenization.
- Vue SFC boundary rules must accept attributes on `<template>` as well as `<script>` and `<style>`, otherwise the
  template falls back to the outer plain-text tokenizer and loses HTML highlighting.
- `WorkspaceCodeEditor/services/language-features.ts` owns only singleton installation, warm-up, and reverse-order
  disposal. TypeScript worker/mirror/provider behavior belongs to `typescript-language-features.ts`; Vue language
  registration and the HTML service definition belong to `vue-language-definition.ts`.

Regression coverage must assert worker routing for `vue`, exact mirror offsets/newlines, named-import module detection,
declaration isolation, manifest module merging, and real-browser completion/Hover for both Vue Source and TypeScript
Config models. Config checks must also prove that worker-provided exports and field properties are visible without duplicate
custom candidates. Lifecycle coverage must also prove reverse disposal, configure-after-dispose, and the pinned `tsMode`
retry when Monaco reports `TypeScript not registered!`.

---

## Source Export Service Boundaries

The export facade keeps generation order and error semantics stable while private services own recursive graph concerns:

- `source.ts` orchestrates the frozen project file set and remains the only production caller of page source generation.
- `source-page.ts` generates one page's Vue source and delegates layout serialization, Registry lookup, portability
  validation, and dependency collection.
- `source-portability.ts` recursively validates every nested node, event, binding, action, and source reference before
  source generation.
- `source-libraries.ts` recursively collects libraries and rejects conflicting declarations for the same package.
- `source-registry.ts` centralizes component lookup and retains the public export error wording.

Regression coverage must include invalid nested components/events/bindings/actions/sources, dependencies that appear only
in child nodes, nested library conflicts, canonical Source snapshots, and byte-stable generated project/page files.

---

## Scenario: Workbench Async Infrastructure Ownership

### 1. Scope / Trigger

Apply this contract when changing Monaco worker/bootstrap code, editor lazy loading, or a persistence callback that can
outlive the project session which created it.

### 2. Signatures

```ts
installMonacoWorkerEnvironment(): void
disposeMonacoLanguageFeatures(): void
onExternalRevision(resolution, message): Promise<void>
```

The export workspace continues to load `WorkspaceCodeEditor` through a literal dynamic import. Persistence callbacks may
call controller commands only while their captured `ProjectEditorSession` is still the controller's active session.

### 3. Contracts

- An absent `globalThis.MonacoEnvironment` is an uninitialized state. Never use `undefined === undefined` as proof that
  the worker router was installed. Record the installed environment only after assigning the router.
- Reuse the installed router while it remains current. If another integration replaces `MonacoEnvironment`, a later
  editor mount wraps that new environment and delegates unknown labels to its `getWorker`.
- Monaco completion providers, hover providers, and TypeScript extra libraries have one singleton disposer owner. Dispose
  and reset them during HMR or an explicit test teardown, never from one editor instance while another can remain mounted.
- The Workbench production build checks the entry's complete static module graph, including HTML module preloads and
  transitive static imports. Monaco markers must exist only outside that initial graph.
- A delayed external-revision callback validates both controller lifetime and captured session identity immediately before
  opening a project. Disposing a persistence subscription does not cancel a Promise continuation already queued.

### 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| First editor mount with no Monaco environment | Install the Workbench worker router |
| Existing environment handles an unknown label | Delegate to its `getWorker` |
| Environment is replaced after an editor mount | Wrap the replacement on the next install call |
| Monaco marker is reachable from an entry preload/static import | Fail the Workbench build |
| Monaco marker exists only in a lazy editor chunk | Pass the lazy-boundary check |
| External reload resolves for the active session | Open the current project revision |
| External reload resolves for a superseded session | Ignore it without changing the active project |

### 5. Good / Base / Bad Cases

- Good: worker routing is installed before editor use, global registrations have one service owner, and editor models,
  mirrors, subscriptions, and observers have explicit instance owners.
- Base: reopening the export dialog reacquires the same lazy Monaco runtime without adding duplicate providers.
- Bad: mark an undefined environment as already installed, scan only the entry file instead of its static dependency graph,
  or let a callback from project A reopen A after project B is active.

### 6. Tests Required

- Happy-DOM tests cover first install without a previous environment, replacement/delegation, provider/extra-lib disposal,
  model reuse, mirror synchronization, and full editor cleanup.
- The Workbench build runs `scripts/verify-monaco-bundle.mjs` after Vite and the Element Plus bundle check.
- Controller tests retain a superseded session callback, switch projects, invoke the callback, and assert the newer project
  remains active.
- The readonly export Playwright scenario must finish with no browser errors; this is the real-worker regression gate.

### 7. Wrong vs Correct

Wrong:

```ts
let installedEnvironment
if (globalThis.MonacoEnvironment === installedEnvironment)
  return
```

Correct:

```ts
let installedEnvironment: MonacoEnvironment | null = null
if (installedEnvironment && globalThis.MonacoEnvironment === installedEnvironment)
  return
```

Wrong:

```ts
if (resolution === 'reload')
  await openProject(capturedSession.snapshot.document.id)
```

Correct:

```ts
if (resolution === 'reload' && projectSession.value === capturedSession)
  await openProject(capturedSession.snapshot.document.id)
```

---

## Dialog Focus From Ephemeral Menus

Workbench dialogs capture `document.activeElement` when their `open` prop becomes true and restore that element after
close. A menu item is not a valid return target because choosing it unmounts the menu. Before emitting an action that opens
a dialog, the menu owner must synchronously focus its stable trigger, then emit the action. Scheduling focus for the next
tick is too late because the dialog watcher may already capture `body` or a detached menu item.

```ts
function chooseMobileAction(action: MobileAction): void {
  closeMobileMenu()
  mobileMenuTrigger.value?.focus()
  emit(action)
}
```

Required regression coverage:

- Choosing Flow, Page Manager, or another dialog workspace from the mobile action menu focuses the stable menu trigger
  before the host event is emitted.
- Closing the resulting dialog restores focus to that trigger, not `body` or an unmounted menu item.
- Escape and pointer-close paths share the same restoration behavior.

---

## Element Plus Inspector Text Controls

Workbench inspector fields that edit user-facing text or JSON must use the
Element Plus `ElInput` component, including the Flow inspector's event-flow
name, node ID, action ref, and node config fields. Do not add a parallel native
`input`/`textarea` border or focus rule for those controls: Element Plus owns
the wrapper, focus state, and `--el-input-*` theme tokens. Feature-specific
text-area behavior belongs on `ElInput` props or the component's inner
`.el-textarea__inner` selector.

Required regression coverage:

- Flow inspector text fields render the Element Plus wrapper and inner control.
- The event-flow name uses the same wrapper/focus structure as other Workbench
  inspector text controls in both light and dark themes.
- No feature stylesheet targets native Flow inspector text controls with a
  competing border or focus treatment.

---

## GitHub Pages Workbench Artifact

The published ConfigForm designer URL is backed by the current Workbench build,
not the historical standalone `@config-form/playground` designer. The Pages
builder must pass `/vue-components/config-form-playground/` as
`CONFIG_FORM_WORKBENCH_BASE`, copy the complete Workbench `dist` directory to
`dist/pages/config-form-playground`, and expose `designer.html` as a byte-equivalent
copy of the Workbench `index.html`. `runtime-host.html` and all referenced assets
must come from that same build directory.

Do not keep a compatibility overlay that mixes old Playground assets with the
Workbench bundle. The artifact verifier must fail when the Workbench filter is
missing, a package filter matches no project, the designer title is stale, or a
generated URL escapes the Pages base path.

Required regression coverage:

- Pages builder source uses the real package names for every playground filter.
- The generated designer and runtime-host entries contain the configured base
  path and Workbench title.
- The final Pages artifact contains no historical standalone Designer entry.
- Changesets `ignore` entries must name existing workspace packages; removing or
  renaming a private playground requires updating `.changeset/config.json` in the
  same change, otherwise `changeset version` fails before publishing.

---

## Automated Accessibility Gate

Workbench production changes must run `pnpm --filter @config-form/workbench test:e2e`. The Playwright suite uses
`@axe-core/playwright` with WCAG 2 A/AA and WCAG 2.1 A/AA tags against the initial template dialog, desktop dark and
light themes, the 390px Inspector, Flow dialog, and Source export dialog. Do not disable a rule or exclude a component
to make this gate pass.

Theme tests run immediately after the theme control is activated. A foreground may not switch instantly while its
background animates through an unreadable intermediate color. Theme-sensitive surfaces must either update atomically or
remove the conflicting color transition. Filled command buttons use a dedicated foreground/background token pair whose
contrast is asserted by the static theme contract as well as axe.

Failure output must retain each target, axe failure summary, foreground/background colors, measured ratio, and expected
ratio. This keeps a browser failure actionable without adding temporary logging.

Required regression coverage:

- The full axe scenario matrix reports zero violations without exclusions.
- Provider controls remain readable immediately after light/dark switching, not only after animations settle.
- Palette specimen containers are both `aria-hidden` and `inert`, so their real Runtime controls never enter the
  accessibility or focus tree.
- Primary export actions meet 4.5:1 in both themes; non-text borders and focus indicators meet 3:1.

---

## Responsive Library Controls And Catalog Drawers

Apply this contract when a Workbench feature uses an Element Plus control only
at one responsive breakpoint or opens a feature-owned catalog in `ElDrawer`.

```ts
useTemplateViewport(): {
  isDesktop: ComputedRef<boolean>
  isMedium: ComputedRef<boolean>
  isMobile: ComputedRef<boolean>
}
```

- A library root that exists only at one breakpoint is conditionally mounted
  from the shared viewport state. Do not rely on a low-specificity
  `display: none` rule: a later-loaded library root rule can make the control
  visible again and create an implicit grid row.
- At 641–1000px, the template catalog is opened through `ElDrawer`; the inline
  catalog remains hidden and the Runtime preview owns the remaining width.
- Drawer open state uses `v-model`. Escape inside the Drawer closes it and the
  final closed state restores focus to the stable rail trigger.
- When other Element Plus focus layers can pause the Drawer layer, the Drawer
  root may capture Escape locally. Keep that handler on the Drawer root so a
  teleported Select popup outside the Drawer retains ownership of its own
  Escape event.
- Appearance and catalog overlays are mutually exclusive. Opening one closes
  the other before focus moves.

| Condition | Required result |
| --- | --- |
| Width is at least 1001px | Show the 280–340px inline catalog; do not mount the mobile segmented control |
| Width is 641–1000px | Show a 52–56px rail and Runtime detail; browse through the Drawer |
| Width is at most 640px | Mount `ElSegmented` and show exactly one catalog/detail pane |
| Drawer closes by Escape, selection, or close button | Remove the overlay and restore the stable trigger |
| A nested Select popup handles Escape | Close the Select popup without stealing the Drawer trigger contract |

Required browser coverage asserts the three breakpoint geometries, no
horizontal overflow, Drawer focus confinement and restoration, mobile
single-pane navigation, axe, and visual sentinels. A source assertion that a
template contains `ElDrawer` or `ElSegmented` is not sufficient.

Wrong:

```vue
<ElSegmented class="mobile-only" />
```

```css
.mobile-only { display: none; }
```

Correct:

```vue
<ElSegmented v-if="isMobile" class="mobile-only" />
```

---
