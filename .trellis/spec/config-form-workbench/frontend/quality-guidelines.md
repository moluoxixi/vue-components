# ConfigForm Workbench Quality Contracts

These contracts apply to the current `packages/ConfigForm/workbench` and its
evolution into the ConfigForm Studio composition root. Read them before
changing Monaco language services, assets, Preview/Experience, Source
composition, dialog focus behavior, or accessibility gates. Current Workbench
facts and target Studio responsibilities must be labeled separately.

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

## Source Viewer Monaco Boundary

Workbench no longer owns an editable Source workspace or Vue/TypeScript
language-service layer. It lazy-loads the export dialog, which consumes the
public readonly `ConfigFormSourceViewer`; the Viewer alone dynamically imports
its Monaco runtime.

Required contracts:

- Root and `/generator` imports never reach Vue DOM or Monaco. `/viewer` may use
  Vue, while the Monaco editor implementation stays behind a literal dynamic
  import inside the text-viewer boundary.
- Only text files create Monaco models. Binary selections render the explicit
  readonly binary state and never initialize Monaco.
- The editor sets both `readOnly` and `domReadOnly`, loads only syntax-language
  contributions, and exposes no completion, Hover, save, or content-change API.
- A path/language change replaces and disposes the previous model; content and
  theme changes update the active session. Unmount disposes the editor, model,
  ResizeObserver/window listener, and ignores a late async load.
- Monaco load failure falls back to focusable plain text without changing the
  controlled `selectedPath` contract.

Regression coverage must prove the lazy boundary, text/binary split, readonly
options, update/disposal lifecycle, load-failure fallback, real-browser Source
dialog behavior, and absence of Monaco from the Workbench initial static graph.

---

## Source Export Service Boundaries

### 1. Scope / Trigger

Apply this contract when changing Source generation integration, the export
dialog/session, stale detection, copy, single-file download, or ZIP assembly.
Workbench owns commands around a pinned export, not generation or source-code
editing.

### 2. Signatures

Workbench is the authoritative owner of the in-memory export session:

```ts
interface ExportSnapshot {
  readonly compilation: ProjectCompilation
  readonly rawSource: ExportArtifact<RawSourceFileSetV1>
  readonly configBindings: ExportArtifact<ConfigBindingFileSetV1>
}

type ExportArtifact<T> =
  | { readonly status: 'ready', readonly fileSet: T }
  | { readonly status: 'failed', readonly diagnostics: readonly ModelDiagnostic[] }
}

interface SourceArchiveInput {
  readonly files: readonly SourceFile[]
  readonly name: string
}

interface BuildExportSnapshotInput {
  readonly compilation: ProjectCompilation
  readonly componentResolver: SourceComponentResolver
  readonly bindingResolver: SourceConfigFormBindingResolver
  readonly resourceReader: SourceResourceReader
}
```

### 3. Contracts

Snapshot freshness compares the complete `ProjectCompilation.key` and its
committed `editVersion` or draft `baseEditVersion + draftId` origin. There is no
generator-version identity: `SourceFileSetV1.version` owns the serialized file
set contract, while an application-code update recreates the memory-only
session. `sync()` may compare identities but must not compile; opening or
explicitly refreshing Export captures one compilation and invokes both
generators independently. The published snapshot always contains one
`ExportArtifact` for each mode, so a mode-specific failure keeps its own
diagnostics without suppressing a successful sibling mode. A session-level
failure before that envelope can be built retains the previous snapshot and
reports it as stale.

Preview, copy, single-file download, and `createSourceArchive` /
`downloadSourceArchive` read the same pinned file-set bytes. Text remains UTF-8;
binary files remain canonical base64 and are decoded to fresh bytes. Archive
roots use the safe project slug, filenames are stable, and object URLs are
revoked only after the browser has had a task to consume the download. The old
Workspace archive names are not aliases and must not be exported.

The generator, `SourceFileSetV1`, file-tree model, and readonly
`ConfigFormSourceViewer` belong to `@moluoxixi/config-form-source`.

- Generator owns deterministic generation plus three distinct input
  responsibilities: provider-neutral `SourceComponentResolver`, ConfigForm-only
  `SourceConfigFormBindingResolver`, and asynchronous
  `SourceResourceReader`. It imports no Designer, Workbench, concrete provider
  UI, Repository, Monaco, Vue DOM, or browser global.
- Studio reads locked adapter metadata and Repository content at its application
  composition root, creates those three implementations, and injects them into
  Source. Raw Vue receives only the component resolver and resource reader;
  ConfigForm binding generation additionally receives the binding resolver.
  Source validates bytes and derives output paths; adapter/storage
  implementations do not become Source dependencies.
- Raw Vue runtime dependencies are limited to `vue`, `vue-router`, and the
  selected target UI package returned by the component resolver. Its manifest
  and generated files contain no `@moluoxixi/*`, `@config-form/*`, Zod,
  ConfigForm, RuleSet converter, Compiler, or internal Runtime import. Field
  validation is emitted as readable project-local TypeScript.
- Studio owns the Source dialog, regeneration, clipboard, single-file download,
  ZIP, notifications, and persistence. Viewer owns none of those commands.
- Viewer renders a file tree and readonly code, with a desktop split and narrow
  tree/code switch. Its `selectedPath` is a required controlled v-model and
  Monaco loads only through the Viewer async boundary.
- Studio Experience consumes Prototype Runtime. Raw generated projects preserve
  the same observable demo behavior as readable application code without
  importing or copying a session reducer/runtime core; ConfigForm bindings
  contain configuration only.
- The move is a completed hard ownership cut. The old Workbench generator and
  editable Viewer are deleted; no wrapper, alias, deprecated export, or
  re-export remains.

### 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Current compilation is missing | Mark an existing snapshot stale and retain its files |
| Compilation key, committed edit version, draft base version, or draft ID changes | Mark the snapshot stale without regenerating during `sync()` |
| Raw Vue generation fails and ConfigForm binding succeeds | Publish Raw as `failed` and Binding as `ready`; keep Binding selectable, copyable, and downloadable |
| ConfigForm binding generation fails and Raw Vue succeeds | Publish Binding as `failed` and Raw as `ready`; keep Raw selectable, copyable, and downloadable |
| One mode's file-set version/path/entry/content is invalid | Source returns diagnostics for that mode; publish its artifact as `failed` without erasing the sibling result |
| Selected mode is `failed` | Show its diagnostics and disable file selection, copy, single-file download, and ZIP for that mode only |
| Export capture/build fails before per-mode results exist | Retain the previous snapshot and expose the session error as stale |
| Raw manifest or source imports a package outside the dependency whitelist | Fail Raw generation/consumer architecture gates; never add an internal package or soft link |
| A binary file is selected | Disable text copy and download the exact decoded bytes |
| Archive name contains unsafe path characters | Use the safe project slug as the single archive root |
| A removed generator-version or Workspace archive symbol appears | Fail the architecture gate; do not add an alias |

### 5. Good / Base / Bad Cases

- Good: one refresh builds `rawSource` and `configBindings` from the same
  compilation, freezes each independent artifact, and publishes a single
  snapshot where one may be `ready` while the other is `failed`.
- Base: switching the selected file or output mode reads the pinned snapshot
  without recompilation.
- Bad: versioning an in-memory generator implementation, refreshing one output
  against a different compilation, treating one mode's failure as atomic failure
  of both, passing the binding resolver to Raw, copying binary through a text
  getter, or restoring an old Workspace wrapper.

### 6. Tests Required

Regression coverage includes Node import without DOM, deterministic generation
for the same compilation/resolvers, per-generator resolution failure with no
partial file set, installed generated-project typecheck/test/build, controlled
Viewer selection, responsive layout, lazy Monaco, accessibility, and executed
Experience/generated-project parity. It proves Raw succeeds when only binding
resolution fails, Binding succeeds when only Raw generation fails, and each
failed-mode dialog disables its commands without disabling the ready mode. Raw
consumer tests cover both providers from real generated files, install no
workspace/internal soft links, and scan every manifest/import for the exact
Vue/Vue Router/target-UI whitelist. Coverage also independently includes
committed and draft stale identity, session-level refresh failure retention,
exact text/binary archive bytes, safe archive roots, deferred URL revocation,
and the absence of old generator-version and Workspace archive symbols. String
containment is not parity evidence.

### 7. Wrong vs Correct

Wrong:

```ts
const rawSource = await generateVueSource({
  compilation,
  componentResolver,
  resourceReader,
  bindingResolver, // Raw must not know this contract.
})
if (!rawSource.success)
  throw rawSource.diagnostics // Incorrectly suppresses the binding result.
```

Correct:

```ts
const snapshot = await buildExportSnapshot({
  compilation,
  componentResolver,
  bindingResolver,
  resourceReader,
})

if (snapshot.rawSource.status === 'ready')
  await downloadSourceArchive({ files: snapshot.rawSource.fileSet.files, name })

// snapshot.configBindings remains independently ready or failed for this same compilation.
```

---

## Scenario: Workbench Async Infrastructure Ownership

### 1. Scope / Trigger

Apply this contract when changing Monaco worker/bootstrap code, editor lazy loading, or a persistence callback that can
outlive the project session which created it.

### 2. Signatures

```ts
loadMonacoViewerRuntime(): Promise<MonacoViewerRuntime>
onExternalRevision(resolution, message): Promise<void>
```

Workbench lazy-loads its export dialog, and the Source Viewer loads its Monaco
runtime through a literal dynamic import. Studio still owns the dialog. Persistence
callbacks may call controller commands only while their captured
`ProjectEditorSession` is still the controller's active session.

### 3. Contracts

- Monaco is requested only after a text viewer mounts. A request that resolves
  after unmount or after a newer request must not create an editor.
- Every Viewer instance owns and disposes its editor model, observer/listener,
  and late-load guard. The readonly Viewer installs no completion/Hover provider
  or TypeScript extra library.
- The Workbench production build checks the entry's complete static module graph, including HTML module preloads and
  transitive static imports. Monaco markers must exist only outside that initial graph.
- A delayed external-revision callback validates both controller lifetime and captured session identity immediately before
  opening a project. Disposing a persistence subscription does not cancel a Promise continuation already queued.

### 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Text viewer mounts | Dynamically load and mount one readonly Monaco session |
| Viewer unmounts before the import resolves | Ignore the stale result and create no editor |
| Binary file is selected | Render binary metadata; do not request Monaco |
| Monaco marker is reachable from an entry preload/static import | Fail the Workbench build |
| Monaco marker exists only in a lazy editor chunk | Pass the lazy-boundary check |
| External reload resolves for the active session | Open the current project revision |
| External reload resolves for a superseded session | Ignore it without changing the active project |

### 5. Good / Base / Bad Cases

- Good: every readonly editor model, subscription, observer, and late-load guard
  has an explicit Viewer-instance owner.
- Base: reopening the export dialog reacquires the lazy Monaco module and creates
  a fresh disposable Viewer session.
- Bad: create Monaco for a binary file, scan only the entry file instead of its
  static dependency graph, or let a callback from project A reopen A after
  project B is active.

### 6. Tests Required

- Happy-DOM tests cover delayed import after unmount, file/theme updates, model
  replacement/disposal, ResizeObserver/listener cleanup, and load failure.
- The Workbench build runs `scripts/verify-monaco-bundle.mjs` after Vite and the Element Plus bundle check.
- Controller tests retain a superseded session callback, switch projects, invoke the callback, and assert the newer project
  remains active.
- The readonly export Playwright scenario must finish with no browser errors; this is the real-worker regression gate.

### 7. Wrong vs Correct

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

- Choosing Page Manager, Source, or another dialog workspace from the mobile action menu focuses the stable menu trigger
  before the host event is emitted.
- Closing the resulting dialog restores focus to that trigger, not `body` or an unmounted menu item.
- Escape and pointer-close paths share the same restoration behavior.

---

## Element Plus Inspector Text Controls

Workbench inspector fields that edit user-facing text or JSON must use the
Element Plus `ElInput` component. Do not add a parallel native
`input`/`textarea` border or focus rule for those controls: Element Plus owns
the wrapper, focus state, and `--el-input-*` theme tokens. Feature-specific
text-area behavior belongs on `ElInput` props or the component's inner
`.el-textarea__inner` selector.

Required regression coverage:

- Inspector text/JSON fields render the Element Plus wrapper and inner control.
- The wrapper/focus structure remains consistent in both light and dark themes.
- No feature stylesheet targets native Inspector text controls with a competing
  border or focus treatment.

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
light themes, the 390px Inspector, Preview dialog, and Source export dialog. Do not disable a rule or exclude a component
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
- Host drag visual containers are both `aria-hidden` and `inert`, so their Runtime controls never enter the
  accessibility or focus tree. Palette items only contain icons and names.
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

## Scenario: JSON Value Boundaries Across Vue And Runtime Hosts

### 1. Scope / Trigger

Apply this contract when Workbench passes reactive project, compilation,
Prototype session, command, projection, or value state into Model services,
iframe messages, or Runtime Host component props.

### 2. Signatures

```ts
cloneWorkbenchJson<T>(value: T): T
```

### 3. Contracts

- Clone reactive JSON inputs through `cloneWorkbenchJson` before crossing an
  iframe, Runtime Host, or plain Model boundary. Do not call native
  `structuredClone` directly on a Vue proxy.
- The helper unwraps the root with Vue `toRaw`, prefers `structuredClone`, and
  falls back to a JSON round trip only because these boundaries already require
  JSON-safe data. It is not a validator and must not be used to make functions,
  DOM nodes, class instances, or other non-JSON values appear supported.
- Every outbound Runtime Host message owns a detached payload. A receiver may
  update its local session or value state without mutating the Workbench source,
  and Workbench must clone accepted inbound snapshots before storing them in
  reactive state.
- Surface identity stays `surfaceId` and runtime state stays keyed by
  `instanceId`; cloning must not collapse those two ownership domains or reuse a
  mutable object between instances.

### 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Reactive `SurfaceGraph`, compilation, session, command, projection, or values cross a host boundary | Convert them to detached plain JSON through `cloneWorkbenchJson` |
| Native structured clone rejects a proxy or host object | Use the helper's deterministic JSON fallback |
| A payload contains a non-JSON value | Reject it through the owning Reader/guard; do not treat cloning as validation |
| Two open instances render the same Surface | Store detached values/projection for each `instanceId` |
| A closed instance sends a late snapshot | Reject it through Runtime Host protocol state; cloning does not make it current |

### 5. Good / Base / Bad Cases

- Good: a reactive Prototype session is cloned before `postMessage`, and the
  accepted reply is cloned again before Workbench stores it.
- Base: non-reactive JSON input clones without semantic changes and does not
  retain nested object identity.
- Bad: pass a Vue proxy directly to `structuredClone`, share one values object
  across two `instanceId` entries, or use the JSON fallback as permission to
  accept an otherwise invalid protocol payload.

### 6. Tests Required

- Unit coverage passes nested Vue reactive JSON to `cloneWorkbenchJson`, asserts
  no `DataCloneError`, deep equality, and detached nested references.
- Runtime Host protocol coverage mutates a delivered message fixture and proves
  the source session/compilation is unchanged; malformed and late messages still
  fail their exact guards.
- Experience coverage opens the same Surface twice and proves values,
  validation, projection, and focus snapshots remain isolated by `instanceId`.

### 7. Wrong vs Correct

Wrong:

```ts
postMessage({ session: structuredClone(reactiveSession) })
instancesById[next.surfaceId] = next.values
```

Correct:

```ts
postMessage({ session: cloneWorkbenchJson(reactiveSession) })
instancesById[next.instanceId] = cloneWorkbenchJson(next.values)
```

---
