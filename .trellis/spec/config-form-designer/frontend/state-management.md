# Project-First ConfigForm State

## 1. Scope / Trigger

Apply this contract when changing the ConfigForm Model package, Workbench state,
Designer commands, project persistence, history, Preview projection, or
Source/Config export.

`ProjectDocument` is the only persisted business content model in the Workbench.
`ProjectSnapshot` is its immutable editor envelope. `PersistedProjectEnvelope`
owns repository metadata. Repository, Design, Runtime, Preview, and Export
accept only the current Project schema; no alternate page or aggregate model
may own a reducer, parser, history, revision, repository, fixture, or projection.

## 2. Canonical Data Flow

```text
ProjectRepository
  -> PersistedProjectEnvelope
     { document, repositoryRevision, entityRevisions, createdAt, updatedAt }
  -> ProjectSaveCoordinator (CAS / commit receipt / save state)

immutable ProjectSnapshot
  -> ProjectDomainEngine (Command / Transaction / History)
  -> ProjectEditorSession (editor facade)

UI / plugin intent
  -> ProjectCommand
  -> resolveProjectCommand
  -> ProjectOperation[]
  -> AppliedProjectTransaction + semantic inverse + ProjectChangeSet
  -> ProjectDomainEngine

ProjectSnapshot
  -> CompileCoordinator
     -> PageCompilation { snapshotIdentity, registryUsage, key, page }
     -> Design Runtime projection
     -> Runtime/Preview projection
  -> lazy ProjectCompilation { snapshot, registry, key, ir }
     -> pinned readonly ExportSnapshot

ProjectSnapshot + candidate transaction
  -> ProjectDraftSnapshot { base identity, document, draftHash }
  -> the same compiler path (never history or persistence)
```

## 3. Signatures

```ts
interface ProjectDomainEngine {
  readonly snapshot: ProjectDomainSnapshot
  execute(command: ProjectCommand): ProjectDomainDispatchResult
  undo(): ProjectDomainDispatchResult
  redo(): ProjectDomainDispatchResult
  sealHistoryGroup(): void
}

interface ProjectEditorSession {
  readonly snapshot: ProjectEditorSessionSnapshot
  execute(command: ProjectCommand): ProjectEditorSessionDispatchResult
  undo(): ProjectEditorSessionDispatchResult
  redo(): ProjectEditorSessionDispatchResult
  save(options: {
    source: 'autosave' | 'manual'
    label?: string
    sealHistoryGroup: boolean
  }): Promise<ProjectEditorSessionSaveResult>
}

interface ProjectSaveCoordinator {
  readonly snapshot: ProjectSaveCoordinatorSnapshot
  save(
    capture: ProjectSaveCapture,
    metadata: ProjectCommitMetadata,
    currentIdentity: () => Pick<ProjectSaveCapture, 'contentHash' | 'cursor' | 'editVersion'>,
  ): Promise<ProjectSaveCoordinatorResult>
}

interface ProjectCommand {
  id: string
  label: string
  actions: ProjectCommandAction[]
  mergeKey?: string
}

interface ProjectNodePatch {
  set?: Partial<ProjectNodePatchValues>
  unset?: ProjectNodePatchKey[]
}

interface ProjectTransaction {
  id: string
  label: string
  operations: ProjectOperation[]
  mergeKey?: string
}

type ProjectStoredConfigRemovalOperation = {
  type: 'node.config.remove'
  pageId: PageId
  nodeId: NodeId
  property: 'bindings' | 'conditions' | 'optionSource' | 'validation' | 'validateOn' | 'valueScope'
  key?: string
}

interface AppliedProjectTransaction {
  transaction: ProjectTransaction
  inverse: ProjectTransaction
  editVersion: number
  contentHash: string
  timestamp: number
}

interface PageGraph {
  version: 3
  props: ModelJsonObject
  form: FormSettings
  root: SlotItem[]
  nodesById: Record<NodeId, FieldNode | LayoutNode>
}

interface ProjectPage {
  id: PageId
  name: string
  route: string
  graph: PageGraph
}

interface SlotItem {
  nodeId: NodeId
  placement: ModelJsonObject
}
```

## 4. Contracts

- The current aggregate is named `Project` across domain types, Controller
  APIs, locale keys, UI labels, tests, templates, and generated-source helpers.
  `Application` is not a domain alias. Standard MIME values such as
  `application/json` and generic host-platform wording are not domain names.
- `PageGraph` stores each node exactly once. Roots live in `root`; all
  descendant relationships live in `LayoutNode.slots`. Both are `SlotItem[]`,
  so layout metadata belongs to the parent-child relation. Default children
  use `slots.default`. A field node cannot own slots.
- UI and plugin code call `ProjectEditorSession.execute(command)`, which delegates
  to `ProjectDomainEngine.execute(command)`. The engine has no Repository,
  persistence, current-page, selection, or Vue dependency. There is no public
  low-level `dispatch` escape hatch.
- A Command expresses intent. A Transaction contains already-resolved
  canonical Operations. History stores the applied Transaction and semantic
  inverse, never an unresolved Command or a full project deep copy.
- A multi-action Command may temporarily violate cross-entity references while
  its actions are being expanded. The complete Operation batch must pass final
  PageGraph, Registry, and schema validation before publication. Failure
  preserves the original snapshot, history, and revision.
- One accepted Command produces at most one editVersion and one history
  entry. Merge keys may combine adjacent history entries without changing
  transaction atomicity.
- Command IDs are idempotent inside ProjectDomainEngine. Reusing an ID with a
  different payload returns `PROJECT_COMMAND_ID_REUSED`.
- Semantic commands are JSON-safe. Node property removal uses explicit
  `patch.unset`; `undefined` is invalid in `patch.set` because JSON,
  postMessage, Worker, and persisted command logs discard it.
- Registry-stale stored configuration uses the narrower
  `node.config.remove` repair operation. `bindings` and `conditions` require one
  safe non-empty `key`; `validation`, `validateOn`, `optionSource`, and
  `valueScope` reject a key and require the matching field/layout node kind. The
  operation carries no replacement value and an absent target is a semantic
  no-op. This low-level repair contract is not a default Designer authoring UI.
- A transaction containing `node.config.remove` contains only that operation
  type and has no `mergeKey`. Forward application still validates the current
  Registry lock and the changed Page schema, while deliberately allowing
  unrelated stale Registry keys to remain. This is what lets the Inspector
  remove one obsolete key without rewriting a record that Registry validation
  would reject as a whole.
- Only History may apply the semantic inverse of an already accepted pure
  `node.config.remove` transaction without Registry revalidation. The inverse
  restores the exact prior schema-valid snapshot; UI commands cannot request
  this inverse mode or use it to write arbitrary stale data. Redo executes the
  original deletion through normal validation again.
- `ProjectDocument` contains no repository revision or persistence timestamps.
  Repository commits use a separate stable commit ID and CAS against the saved
  repository revision. `ProjectSaveCoordinator` owns commit ID generation,
  repositoryRevision, savedCursor, saving, and persistence diagnostics. Commit
  IDs include a per-editor-session namespace so two tabs cannot both emit
  `<project>:save:1` and be mistaken for a payload replay.
- `ProjectEditorSession.save()` is an explicit hard-cut boundary: autosave uses
  `source: 'autosave'` and `sealHistoryGroup: false`; user-triggered immediate
  saves and named checkpoints use `source: 'manual'` and may seal the current
  merge group. There is no no-argument save path.
- Saving captures one immutable document and history cursor. Edits made while
  save is pending remain local and dirty; they are not merged into the captured
  commit or its merge group.
- `ProjectSnapshot` is `{ document, editVersion, contentHash }`; it may use structural sharing but is deeply readonly at API
  boundaries. UI code must not cast it to mutable data.
- Editor facades may expose a superset such as
  `ProjectEditorSessionSnapshot`, but compiler and export boundaries must build
  an exact `ProjectSnapshot` envelope explicitly. Never pass the session
  snapshot through a cast or object spread: its persistence, history, and UI
  fields are intentionally rejected by the strict compilation schema.
- Drag and other speculative design operations use `ProjectDraftSnapshot`, which
  binds the committed base identity to a separate `draftHash`. A draft may enter
  the semantic compiler, but it cannot enter ProjectDomainEngine history,
  Repository, save coordination, or the committed Project Store stream.
- In Design mode the real Runtime form is a non-interactive visual plane. Its
  form root is `inert` and `aria-hidden`, runtime nodes expose presentation
  metadata without focus/click handlers, and the editor overlay owns focus,
  selection, hit testing, resize, and node actions. Geometry hit testing uses
  registered Runtime node rectangles and prefers the deepest matching node.
  A collapsed drop indicator is reserved for zero-height containers; normal
  Runtime controls must keep their measured geometry and must not receive an
  invented placeholder frame during drag.
- Runtime accepts an optional transient `breakpoint` presentation value for
  fixed Design/Preview artboards. When supplied, it pins the active grid
  columns and node spans through the same Runtime layout resolver instead of
  depending on the host viewport media query. The value is never persisted in
  `ProjectDocument` or treated as a design operation.
  Preview uses a separate Runtime instance and remains natively interactive.
- Selection overlay focus styles must be explicit on the overlay itself. Adapter
  styles may reset `[tabindex="-1"]:focus { outline: none; }`; such resets must
  not hide the editor selection affordance.
- Designer editor chrome is governed by one explicit overlay mode:
  `idle`, `selected`, `keyboard-dragging`, `pointer-dragging`, or `resizing`.
  The mode is a rendering contract, not a second model state. Pointer dragging
  hides stale selection and policy overlays; dragging shows the Runtime
  candidate and pointer-following visual; resizing keeps only the active
  selection and resize handle. New editor feedback must declare its mode
  priority before it is rendered.
- Selection chrome must remain visually outside the Runtime control (with an
  explicit gap or equivalent editor-only affordance) so it cannot be mistaken
  for a library focus ring. Design policy diagnostics are contextual: render
  only for the primary selected node, never as a marker on every adapter node.
- Any change to editor chrome requires a browser regression that asserts the
  Runtime control remains inert, the editor overlay owns focus, and the
  relevant overlay count/geometry changes across selected, dragging, nested,
  and resizing states. A unit test that only checks rendered class names is
  insufficient evidence for visual interaction behavior.
- `DesignSurface` is a controlled `PageGraph` editor. It receives one
  `DesignerCommandControl`, forwards every edit as a `ProjectCommand`, and must
  use the same candidate `PageCompilation` contract as the Workbench Canvas.
  A second document reducer or local structural history is forbidden.
- Pointer coordinates are transient overlay state. Moving the pointer inside
  one unchanged drop target may reposition the drag visual, but it must not
  invalidate or rebuild the structural candidate Runtime projection. Candidate
  compilation dependencies are the drag source, normalized drop target, base
  document identity, and Registry contract.
- Keyboard material drag startup is allowed a short cancellable retry window
  when the target resolver is settling across the first Vue render frame. The
  retry reuses one candidate ID, stops on success, Escape, readonly/unmount, or
  a bounded attempt count, and never creates a second model or history entry.
  Register keyboard targets during setup so a fast Space press has a resolver;
  do not hide this race by adding waits to browser tests.
- Palette specimen styling must target Designer-owned wrapper classes. Broad
  descendant selectors such as `label`, `input`, or `button` are forbidden
  because the specimen is a real adapter Runtime and owns its internal DOM.
- Realtime semantic compilation returns one immutable `PageCompilation`
  binding snapshot identity, actually used Registry contracts, compiler
  identity, and Canonical Page IR. `CompileCoordinator` consumes adjacent
  `ProjectChangeSet.pageIds` plus page-qualified `nodeChanges`, reuses
  unaffected page/key and node identities, keeps draft and committed caches
  separate, and falls back to conservative invalidation when attribution is
  missing. Runtime and Preview must not pair these inputs independently.
- Canonical node identity must not duplicate sibling indexes or full ancestry
  paths. Order belongs to `rootIds` / layout `slots`; parent and slot belong to
  placement; a path is derived when traversing. Each node carries a subtree
  hash so an updated leaf only recreates that node and its semantic ancestors.
- Drag candidates created from a validated Project Transaction use the trusted
  draft snapshot path. They must not reparse the complete ProjectDocument.
  The Vue backend caches successful Runtime fragments by resolver and immutable
  Canonical node identity; changed ancestors are rebuilt while unrelated real
  component fragments retain object identity.
- The Workbench may memoize successful committed Vue Runtime artifacts by exact
  `PageCompilation.key` object identity. This cache is bounded, page-scoped,
  cleared on project/adapter disposal, and must never admit draft or failed
  artifacts. Reusing an unaffected page must skip both semantic and Vue backend
  compilation.
- Full `ProjectCompilation` assembly is reserved for an explicit readonly
  Export capture/refresh. Ordinary Design edits invalidate the pinned Export
  identity but do not compile other pages or rebuild generated files.
- Persistence scheduling is owned by one `ProjectPersistenceSession`, not by
  Inspector, Designer, Preview, or Pages. It coalesces edits with an 800ms idle /
  5s maximum autosave policy and a 250ms idle / 1s maximum durable recovery
  draft policy. A save captures one edit identity; edits arriving while it is
  in flight remain pending for the next save. Draft coverage is tracked
  independently from formal save status so volatile or failed storage cannot
  be presented as recoverable.
- Recovery drafts are validated, project-scoped, and never silently applied.
  A newer draft must not be overwritten by an older capture; after a formal
  save, rebasing a newer draft is write-before-delete. Drafts with unknown
  presence, corrupt schema/checksum, or Registry mismatch fail closed.
- Cross-tab coordination sends only versioned revision hints and presence
  probes. Clean sessions reload after Repository confirmation; dirty sessions
  pause autosave and retain a durable draft until the user chooses an explicit
  conflict path. Duplicate, stale, out-of-order, self, or unavailable channel
  messages never replace CAS correctness.
- Workbench composition exposes independent `WorkbenchDesignSession`,
  `PreviewSession`, `WorkbenchExportService`, and `WorkbenchUiStore` contexts.
  Design owns active/candidate page compilation, Runtime artifacts, selection,
  command execution, and Undo/Redo. Export owns lazy full-project compilation
  and pinned identity invalidation. The controller wires project/navigation
  publication only; the Shell consumes contexts and routes view/dialog events.
- A committed Design publication failure clears the unusable Runtime artifact
  and forwards its first compiler diagnostic to Workbench UI. Rendering an
  unexplained empty `provider-surface` is forbidden. Transient invalid drag
  candidates may still remain silent because the committed Runtime stays
  visible and final command execution owns the user-facing diagnostic.
- Design and Preview each run in a dedicated same-origin iframe RuntimeHost.
  The parent sends only structured-cloneable `PageCompilation`, adapter
  identity, presentation, values, reaction projection, and design-session
  metadata. Vue Components, resolver functions, validators, DOM nodes, and
  full Runtime plans never cross the message boundary; each iframe loads its
  adapter and compiles the Vue Runtime plan in its own realm.
- RuntimeHost messages use one versioned protocol with channel, session,
  revision, and monotonic sequence identities. Both realms validate source,
  origin, protocol version, session, and payload shape before accepting a
  message. Replayed, stale-revision, or out-of-order messages are ignored.
- Structural RuntimeHost sync and transient state sync are separate. Model or
  reaction projection changes send only values/reaction state; they must not clone
  or recompile the complete `PageCompilation`. A same-page revision keeps one
  runtime session.
- Each RuntimeHost realm loads provider CSS and owns its Teleport targets.
  Workbench theme CSS must not enter the iframe. Component listener functions,
  listener names, and argument snapshots never cross the bridge. Preview may
  transport form values, field-change state, validation, submit results, Data
  requests, and design geometry through their explicit protocols; none is an
  event-authoring or action-dispatch channel.
- Workbench has no component-event authoring path, action registry, handler
  registry, or event forwarding RPC. Host-only `props.onX` functions
  are composed in the consuming Vue/TypeScript application and are outside
  ProjectDocument, Preview, and Source.
- Design Runtime nodes register geometry by stable `nodeId`; ancestry path and
  slot are mutable traversal metadata, not registration identity. Candidate
  moves between nested slots must update the registration without allowing an
  old cleanup callback to remove the new geometry entry.
- Selection, drop, resize, and node actions stay in the parent editor overlay.
  The Design Runtime DOM remains an inert business tree. Geometry and pointer
  messages are validated by the same versioned RuntimeHost protocol, and the
  host must preserve pointer capture through down/move/up/cancel across the
  iframe lifecycle.
- Canvas candidate and pointer-following drag visual use separate Design
  RuntimeHost instances fed by the same candidate `PageCompilation`. The drag
  visual is not a hand-authored control or an editor-owned DOM approximation;
  parity tests must compare stable node identity, visible DOM signature, and
  measured geometry.
- The current page ID is Design/Workbench navigation state, not a
  ProjectDomainEngine or ProjectEditorSessionSnapshot field. Switching pages
  republishes the relevant projection but does not create a project revision or
  history entry.
- Component keys resolve through the Registry Contract. Arbitrary HTML tags,
  Vue component instances, icons, or functions never enter ProjectDocument.
- Design, Pages, RuntimeHost, and Export consume `ProjectDocument`,
  `ProjectSnapshot`, `PageGraph`, or fixed compiler artifacts directly. There
  is no page-tree projection or project wrapper between those boundaries.
- Runtime form values, touched state, validation, Data requests/cancellation,
  panel state, selection, drag candidates, and Monaco models are
  transient session/UI state.
- Source and Config are read-only. They pin one immutable export revision;
  later design edits mark the session stale rather than partially replacing
  files.
- Element Plus owns general-purpose Workbench chrome only: buttons, tooltips,
  dropdowns, tabs, inputs, scrollbars, empty states, dialogs, drawers, and
  alerts. Thin Workbench components may connect those controls to i18n,
  commands, sessions, and stable test identifiers, but must not copy the
  component library's focus, keyboard, modal, or menu state machines.
- Workbench template components use `unplugin-vue-components` with
  `ElementPlusResolver({ importStyle: 'css' })`. Full-library installation,
  `app.use(ElementPlus)`, default `ElementPlus` imports, and
  `element-plus/dist/index.css` are forbidden.
- Parent-document dialogs, drawers, menus, and notifications belong under the
  dedicated `#workbench-overlays` root. That root mirrors Workbench theme
  tokens and z-index behavior, while Design and Preview Runtime poppers remain
  inside their own iframe realms. Workbench theme CSS must never enter a
  RuntimeHost document.
- Workbench `ElDropdown`, `ElTooltip`, and `ElSelect` keep teleporting enabled
  and set `append-to="#workbench-overlays"`. Do not use `teleported="false"`
  inside the Topbar or scrollable editor panels: inline poppers are clipped by
  panel overflow and do not inherit the overlay root's theme/z-index contract.
  Unit tests create the real target and query teleported content from it.
  Pointer-transparent help tooltips use a dedicated popper class; never disable
  pointer events through Element Plus's generic `.el-tooltip` class because
  interactive Dropdown poppers also carry that internal class.
- A delegated virtual tooltip must position through a non-DOM `Measurable`
  proxy when the command trigger owns semantic ARIA such as `aria-controls`,
  `aria-haspopup`, or `aria-expanded`. Passing the focusable command element
  directly to `ElTooltip.virtual-ref` lets Element Plus overwrite and later
  remove those attributes when the virtual reference changes.
- Commands that replace focus with a Dialog/Drawer run on the tick after the
  Dropdown closes. Restore the stable trigger first, then open the workspace;
  mounting a modal during the Dropdown item's synchronous close handler can
  race Popper positioning against removed reference geometry.
- Preview drawer positioning is a cross-realm geometry contract. Its overlay
  begins below the fixed Workbench topbar, and the drawer/stage must not animate
  their coordinate space while iframe geometry is sampled. Runtime content and
  parent stage rectangles must be comparable without timing waits.
- Canvas camera, selection, resize, drag candidate/visual, Registry specimens,
  schema-driven setters, RuntimeHost bridges, and Monaco models
  remain domain-owned. Replacing them with a general UI component is allowed
  only when Project Command ownership, Runtime geometry, and provider isolation
  remain unchanged; generic `BaseButton` / `BaseTabs` abstraction layers are
  forbidden.

## 5. Repository Boundary

- Repository storage may split Manifest, Page, and Resource entities. A Page
  entity stores the current `ProjectPage` and its `PageGraph`; it does not store
  action graphs or event metadata. The manifest references exact revisioned keys
  and checksums.
- `load` publishes only a complete validated `PersistedProjectEnvelope`. Missing entities,
  checksum drift, or mismatched project IDs return
  `PROJECT_REPOSITORY_CORRUPT`.
- `commit` writes new entities, the manifest, and commit receipt in one native
  atomic storage transaction.
- Repository open/load validates the current schema version and Registry lock.
  Unknown versions, records from other namespaces, incomplete entities, and
  ambiguous entity ownership fail closed with `PROJECT_REPOSITORY_CORRUPT`.
  Load never scans, rewrites, or deletes the rejected source record.

## 6. Error Matrix

| Condition | Required result |
| --- | --- |
| Empty Command or Transaction | Diagnostic; no mutation or revision |
| Unknown page/node/component/slot | Structured diagnostic; atomic rollback |
| Final command graph has a dangling reference or cycle | Diagnostic; atomic rollback |
| Intermediate action is invalid but final batch is valid | Resolve and validate the final batch |
| Reused command ID with identical payload | Idempotent no-op |
| Reused command ID with different payload | `PROJECT_COMMAND_ID_REUSED` |
| Node patch sets `undefined` | `PROJECT_NODE_PATCH_VALUE_UNDEFINED` |
| Node patch sets and unsets the same key | `PROJECT_NODE_PATCH_CONFLICT` |
| Stored record removal omits or uses an unsafe key | `PROJECT_NODE_CONFIG_REMOVE_KEY_REQUIRED` / `PROJECT_NODE_CONFIG_REMOVE_KEY_INVALID`; atomic rollback |
| `validation` / `validateOn` removal supplies a key or targets a layout | `PROJECT_NODE_CONFIG_REMOVE_KEY_UNEXPECTED` / `PROJECT_NODE_CONFIG_REMOVE_KIND_INVALID`; atomic rollback |
| Stored configuration removal is mixed with another operation | `PROJECT_NODE_CONFIG_REMOVE_MIXED`; atomic rollback |
| Stored configuration removal supplies `mergeKey` | `PROJECT_NODE_CONFIG_REMOVE_MERGE_INVALID`; atomic rollback |
| Repository CAS mismatch | `PROJECT_REVISION_CONFLICT`; preserve local edits |
| Two editor sessions save their first edit | Unique commit IDs; stale tab receives CAS conflict, not command reuse |
| Save succeeds while newer edits exist | Saved captured revision; local state remains dirty |
| Export generation fails | Preserve the previous complete export snapshot |

## 7. Tests Required

- Model unit tests cover current schema invariants, every Operation, semantic
  inverse, command expansion, multi-action final validation, merge, undo/redo,
  no-op revisions, structural sharing, and performance at 100/500/2000 nodes.
- Model repair tests start from a schema-valid document with multiple unrelated
  Registry-stale binding/condition keys, prove an ordinary record rewrite fails,
  remove only the named target, preserve every sibling key, and prove one
  Undo/Redo round trip restores and removes the exact structured value.
- Designer and Workbench tests prove removal intent is absent when matching
  material/contract evidence is missing, readonly keeps the value visible but
  disables deletion, heterogeneous selection identifies the owning node, and
  browser Undo restores the stale item through the Project history timeline.
- Repository tests cover atomic multi-key create/commit, checksums, missing
  entities, CAS across connections, command receipt replay, quota/partial
  failure, save-during-edit, strict version rejection, and source-record
  preservation.
- Architecture boundary tests prove the Domain Engine does not import
  Repository, Vue, Designer, Workbench, current-page, or saving contracts and
  that the production Workbench controller cannot import a parallel reducer or
  page model. Hard-cut boundary tests also assert removed schema, migration,
  compatibility, repository, session, and codec modules do not return, and
  `ProjectHistory` does not expose a second document alias beside `snapshot`.
  The Workbench boundary recursively scans ConfigForm source, tests, scripts,
  templates, and public declarations for exact legacy symbols and asserts all
  removed module and directory paths stay absent.
- Workbench boundary tests prove Design and Page Manager intents become Project
  Commands and no intermediate structural model can become the state source.
- Workbench service tests prove Design publishes one `PageCompilation`, draft
  candidates do not mutate the committed snapshot, Undo/Redo delegate to
  `ProjectEditorSession`, Export `sync()` never compiles, and only `capture()`
  assembles a full `ProjectCompilation`. They also assert committed compile
  failures reach the UI diagnostic boundary instead of producing a blank
  canvas.
- Browser tests prove one visual design action advances one project revision,
  Undo/Redo use ProjectDomainEngine through ProjectEditorSession, page
  switching does not create history, and
  Preview/Export observe the same project revision.
- Designer regression tests cover the controlled Canvas command and preview
  contract. Repeated pointer moves within the
  same normalized drop target call that projection once, while a target change
  creates a new projection.
- Browser tests click the geometry of real Design controls and prove that focus
  stays on the editor overlay, keyboard input cannot mutate Design values,
  nested nodes select the deepest registered Runtime rectangle, and the same
  component remains interactive in Preview. These checks must run for every
  supported UI adapter.
- RuntimeHost tests structured-clone a real `PageCompilation`, reject invalid
  source/origin/session/version/payloads, exercise model/submit/field state and
  Data request protocols through the iframe, and prove provider Teleports plus Runtime computed
  styles stay inside the iframe across Workbench Light/Dark changes. Design
  tests additionally cover geometry sync, nested hit testing, pointer
  down/move/up/cancel, stable registration across slot moves, and candidate /
  drag-visual Runtime parity.

### 7.1 Good / Base / Bad Cases

- Good: delete `bindings.legacy.remove` while `bindings.legacy.keep` and an
  unknown condition remain, then Undo restores the exact nested value.
- Base: delete an already absent supported path; publish no revision or history
  entry.
- Bad: rewrite the full `bindings` record, mix repair with `page.rename`, attach a
  merge key, or expose Registry-validation bypass as a UI option.

## 8. Wrong vs Correct

Wrong:

```ts
secondaryPageStore.replace(currentPage)
designerHistory.push(structuredClone(pageTree))
```

Correct:

```ts
projectEditorSession.execute({
  id: nextCommandId(),
  label: 'Update design',
  actions: [{
    type: 'node.patch',
    pageId,
    nodeId,
    patch: { set: { label: 'Name' }, unset: ['validation'] },
  }],
})
```

Wrong: watch generated Config or Source and parse it back into the project.

Correct: derive Design, Preview, Config, Source, and file-tree projections from
the current immutable ProjectSnapshot.

For Registry-stale repair, correct means one exact monotonic operation:

```ts
projectEditorSession.execute({
  id: nextCommandId(),
  label: 'Remove stored configuration',
  actions: [{
    type: 'operation.apply',
    operations: [{
      type: 'node.config.remove',
      pageId,
      nodeId,
      property: 'bindings',
      key: 'legacy.value',
    }],
  }],
})
```

Wrong: copy the remaining stale record into `node.bindings`, mix the repair with
ordinary edits, or add a replacement value to `node.config.remove`.

## 9. Source Export Ownership

Designer owns neither source generation nor export-session state. It exposes a
current `ProjectCompilation` through the Studio composition root and otherwise
has no dependency on Source or Workbench.

`@moluoxixi/config-form-source` owns `SourceFileSetV1`, deterministic raw Vue
and ConfigForm binding generation, and the readonly Viewer. Workbench owns the
pinned `ExportSnapshot`, stale detection, refresh, copy, file download, and ZIP
commands. The authoritative snapshot and archive contract is maintained in
`config-form-workbench/frontend/quality-guidelines.md`; do not duplicate it in
Designer or add a generator version, Workspace file abstraction, editable
source view, wrapper, alias, or compatibility path here.

Workbench and Designer still follow the shared responsibility-based directory
spec. Feature roots use named concern directories and one barrel per present
concern; Vue props/emits/expose/slots live under `types/`. Package roots do not
retain old subpath aliases, and architecture scans reject flat concern files,
duplicate public names, and legacy/deprecated/migration/compat entry points.

## 10. RuntimeHost Preview State Synchronization

### 10.1 Scope / Trigger

Apply this contract when changing RuntimeHost messages, Preview lifecycle,
Renderer error/meta notifications, Data request transport, or state restoration across
an iframe reload, adapter load, project/page switch, or Design revision.

### 10.2 Signatures

```ts
interface RuntimeHostMessageBase {
  channel: 'mx-config-form-runtime-host'
  version: 6
  hostId: string
  projectId: string
  pageId: string
  revision: string
  sequence: number
}

interface RuntimeHostRuntimeStatePayload {
  values: Record<string, unknown>
  touched: string[]
  validation: Record<string, string[]>
}

interface RuntimeHostSubmitResultPayload extends RuntimeHostRuntimeStatePayload {
  status: 'success' | 'invalid'
}

interface PreviewRuntimeIdentity {
  hostId: string
  projectId: string
  pageId: string
  revision: string
}
```

### 10.3 Contracts

- Parent and iframe validate the complete host/project/page/revision identity
  and reject non-monotonic sequence numbers before publishing an event.
- Structural `sync` and transient `state` are separate messages. Both carry
  one atomic runtime snapshot; values, touched, and validation cannot be sent
  or restored independently.
- Runtime submit emits one atomic `submitResult` payload with `success` or
  `invalid` status. A successful form-level submit notification is separate from
  the result snapshot; neither message dispatches an action or component event.
- Adapter loading and Runtime compilation are asynchronous. The iframe retains
  the state payload with the highest accepted sequence and, after the Renderer
  mounts, restores that payload rather than the older payload captured by the
  structural sync.
- A stale restore checks its sequence before writing values. Concurrent parent
  restores use reference-counted callback suppression, so an older completion
  cannot re-enable child-to-parent events while a newer restore is active.
- Restoring values, touched, or validation that are already equal is a no-op.
  In particular, do not call `setValues` or `setErrors` for an echoed snapshot,
  because both invalidate in-flight validation generations.
- `PreviewSession` owns values, touched, validation, submission state, and
  compatible field-contract reconciliation. Field changes install their latest
  values before publishing the explicit form-state notification.
- On a same-scope revision, Preview keeps state only for fields whose
  `nodeId + component + contractVersion + fingerprint` contract is unchanged.
  Project, page, adapter, removed field, or changed contract resets the affected
  state. Runtime messages from a stale host or revision are ignored.
- `PreviewSession.lastSubmission` is transient, carries the accepted revision
  key, and is cleared on scope changes, revision changes, compile failures, or
  explicit user clearing. Clearing the result never resets Preview values.

### 10.4 Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Wrong host, project, page, or revision | Reject before emitting to PreviewSession |
| Replayed or lower sequence | Ignore without changing Runtime or Preview state |
| New state arrives while structural sync compiles | Mount with the newest values/touched/validation |
| Older restore finishes after newer restore starts | Older restore is a no-op; callback suppression remains active |
| Parent echoes an identical snapshot | No Renderer value/error/meta mutation |
| Field contract changes at the same page | Reset that field to its new default and remove touched/errors |
| Preview page/project/adapter changes | Reset scope state, submission, mount identity, and async work |
| Field change publishes from the iframe | Parent observes the already-updated values; no component-event payload is forwarded |

### 10.5 Good / Base / Bad Cases

- Good: `sync(seq=1)` starts adapter loading, `state(seq=2)` arrives, and the
  newly mounted Renderer restores only state from `seq=2`.
- Base: a same-page revision preserves a compatible edited value and its error;
  closing and reopening the iframe creates a new host while PreviewSession keeps
  the compatible snapshot.
- Bad: apply `sync.runtimeState` after an `await`, then check whether the sync is
  stale. The write already replaced newer values and can cancel validation.

### 10.6 Tests Required

- Protocol unit tests validate the complete v6 identity, runtime-state and
  submit-result payloads,
  stale revision, replay, source, and origin.
- RuntimeHost component tests control adapter resolution and assert a state that
  arrives during compilation wins for values, touched, and validation.
- RuntimeHost tests send the same state again and assert `setTouched` and
  `setErrors` are not called a second time.
- PreviewSession tests cover compatible reconciliation, contract changes,
  project/page/adapter reset, stale hosts, submission cleanup, and field-change
  value ordering.
- Headless tests prove `setErrors` invalidates older async validation; Renderer
  tests prove the restored snapshot emits `errorsChange`.
- Browser tests cover interactive Preview input, close/reopen, field state,
  validation, submit, Data requests, page switch, and a clean warning/error console.

### 10.7 Wrong vs Correct

Wrong:

```ts
modelValue.value = clone(sync.runtimeState.values)
await loadAdapter()
if (sync.sequence !== latestSequence)
  return
```

Correct:

```ts
latestRuntimeState = clone(message.runtimeState)
latestSequence = message.sequence
await loadAdapter()
await applyRuntimeState(latestRuntimeState, latestSequence)
// applyRuntimeState checks the sequence before its first write.
```

## 11. Local Editing History And Shortcut Contract

### 11.1 Scope / Trigger

Apply this contract when changing Domain Engine history, `ProjectEditorSession`,
Designer editing shortcuts, batch node actions, deletion feedback, or the local
History panel. This history is scoped to the current editor session. Persisted
checkpoints and repository revisions are separate concepts.

### 11.2 Signatures

```ts
interface ProjectHistoryEntrySummary {
  readonly id: string
  readonly label: string
  readonly editVersion: number
  readonly timestamp: number
}

interface ProjectHistorySummary {
  /** Chronological past plus redo entries. */
  readonly entries: readonly ProjectHistoryEntrySummary[]
  /** Number of entries currently applied. */
  readonly position: number
  readonly limit: number
}

interface DesignerHistoryControl {
  canUndo: boolean
  canRedo: boolean
  history?: ProjectHistorySummary
  undo: () => boolean
  redo: () => boolean
}

interface WorkbenchHistoryControl extends DesignerHistoryControl {
  jump: (position: number) => boolean
}

type DesignerNotice = {
  message: string
  undo?: () => boolean
}
```

### 11.3 Contracts

- `ProjectDomainEngine` owns the mutable history internals. Its snapshot exposes
  only a frozen summary; transactions, inverses, mutable arrays, and historical
  documents never cross into Session or UI code.
- History entry ids are session-local opaque identities. They remain stable
  across undo, redo, and history-group sealing, and cannot be derived by
  concatenating command ids because a later legal command may use the same
  string.
- `entries` is chronological and includes redo entries after `position`.
  `position === 0` means the earliest retained state and
  `position === entries.length` means the latest retained state. The earliest
  retained state may be newer than the original document after the history
  limit discards old entries.
- The editor cursor at `position === 0` identifies that retained base state.
  After limit truncation it must not alias the original document cursor or make
  a still-modified editor session appear clean.
- A History jump validates an integer position in the retained range and reaches
  it only by repeated `ProjectEditorSession.undo()` or `redo()` calls. It never
  writes a captured UI document back into the Engine.
- A command accepted after jumping backward uses the Engine's normal branch
  semantics: the redo suffix is removed deterministically. Selection, hover,
  camera, active panel, and drag intermediate frames do not create entries.
- Duplicate, delete, move, and batch property edits submit one `ProjectCommand`.
  One accepted user intent creates at most one edit version and one history
  entry, regardless of the selected-node count.
- `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, `Ctrl+Y`, `Ctrl/Cmd+D`, and
  `Delete/Backspace` are handled by the DesignSurface root. The handler exits
  for prevented or composing events, readonly mode, `INPUT`, `TEXTAREA`,
  `SELECT`, `OPTION`, and `contenteditable` descendants. Preview iframe and
  readonly Monaco surfaces remain outside this keyboard scope.
- Successful deletion publishes an accessible notice whose Undo action targets
  the expected history position. If another history transition has already
  occurred, the action is stale and returns `false`. The Workbench notice store
  permits the action to run only once.

### 11.4 Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Jump target is fractional, negative, or beyond `entries.length` | Return `false`; preserve document and history. |
| Undo or redo fails during a jump | Stop at the reached position and publish the Engine diagnostic. |
| Shortcut originates in a text editing target | Preserve native editing behavior; do not submit a Project Command. |
| Designer is readonly or an IME composition is active | Ignore the editing shortcut. |
| Deletion Undo notice no longer matches the expected position | Return `false`; do not undo an unrelated command. |
| Notice action is invoked twice | The second invocation is a no-op. |
| A new command is accepted from an older history position | Truncate the redo suffix and publish the new branch. |
| A command id equals the concatenated ids of a merged entry | Publish distinct stable entry ids and cursors. |
| Undo reaches position zero after history-limit truncation | Use the retained base cursor, not the original document cursor. |

### 11.5 Good / Base / Bad Cases

- Good: select five nodes, press Delete, create one command, show one Undo
  notice, and restore all five nodes with one Engine undo.
- Base: click an older retained history row and move through Engine undo/redo
  until that position becomes current.
- Bad: store full `ProjectDocument` copies in the History panel, mutate
  `history.entries`, or let Backspace delete a node while an Inspector input is
  focused.

### 11.6 Tests Required

- Model unit tests freeze the summary, preserve chronological past/future order,
  enforce the limit, prove redo-branch truncation, distinguish merged-id
  collisions, and keep the truncated base cursor distinct from the original.
- Designer component tests cover Windows/Linux and macOS modifiers, batch
  duplicate/delete command cardinality, readonly mode, composition, and every
  text-editing target boundary.
- Workbench session tests jump backward and forward exclusively through
  `ProjectEditorSession`, reject invalid positions, stop on diagnostics, and
  produce a new branch after editing an older position.
- Notice-store tests prove single use, timeout/replace cleanup, and stale
  deletion callbacks cannot undo a later command.
- Element Plus and Ant Design Vue browser tests cover Layers multi-selection,
  duplicate, delete, notice Undo, History jump, redo truncation, and Inspector
  input isolation on the same project timeline.

### 11.7 Wrong vs Correct

Wrong:

```ts
historyPanel.onSelect(document => editor.replaceDocument(document))
selectedIds.forEach(nodeId => session.execute(removeNode(nodeId)))
```

Correct:

```ts
while (session.snapshot.history.position > targetPosition)
  session.undo()

session.execute({
  id: nextCommandId(),
  label: 'Remove components',
  actions: [{ type: 'transaction', operations: selectedIds.map(removeNode) }],
})
```

## 12. Template Creation Workspace Contract

### 12.1 Scope / Trigger

Apply this contract when changing template providers, catalog validation,
template preview, project/page creation, or the Workbench transition between
the Designer and a creation source.

### 12.2 Signatures

```ts
interface TemplateCatalogProvider {
  readonly id: string
  list: () => Promise<readonly unknown[]>
}

const PROJECT_TEMPLATE_VERSION = 1 as const

interface ProjectTemplateManifest {
  version: typeof PROJECT_TEMPLATE_VERSION
  // current manifest fields
}

interface TemplateCatalogLoadResult {
  templates: ProjectTemplateCatalogEntry[]
  diagnostics: TemplateCatalogDiagnostic[]
}

interface ProjectIdentityFactory {
  create: (kind: TemplateIdentityKind, source: string) => string
}

createProjectFromTemplate(
  template: ProjectTemplateCatalogEntry,
  name?: string,
): Promise<boolean>

createPageFromTemplate(
  template: ProjectTemplateCatalogEntry,
  name?: string,
): Promise<boolean>
```

### 12.3 Contracts

- Workbench `App` owns the top-level `designer | create` view, the explicit
  `project | page` creation target, and a stable return-focus key.
  `WorkbenchShell` edits only the active project and must not import a template
  catalog, template browsing state, or template preview service.
- A `TemplateCatalogProvider` is readonly and asynchronous. It returns only a
  JSON-safe manifest plus page seed. The catalog service is the single
  `unknown -> typed` boundary for provider/template ids, dangerous keys,
  schema version, category, adapter, Registry requirements, seed schema, duplicate
  detection, diagnostics, and stable ordering. UI code must not parse or cast
  provider payloads. One Provider may return at most 256 entries; any array in
  one seed may contain at most 4096 items, and the array-length guard runs
  before recursive JSON-safe traversal. Manifest `order` is a non-negative
  integer.
- `manifest.version` is the template wire-format identity and must equal
  `PROJECT_TEMPLATE_VERSION`. Missing, lower, or higher values are
  rejected; there is no template migration or shape fallback. The old content
  revision meaning is removed, and `schemaVersion`, `protocolVersion`, or
  `storageSchemaVersion` are rejected rather than aliased. Preview and cache
  identity use a canonical fingerprint of the validated seed instead of a
  mutable integer revision.
- Search, filters, selected template, mobile pane, eligibility state,
  preview request identity, and preview Runtime values/touched/validation are
  feature-local transient state. They never enter `ProjectDocument`, the
  active `PreviewSession`, history, selection, persistence revision, recovery
  drafts, or autosave.
- Template preview instantiates an in-memory candidate, constructs the exact
  `ProjectSnapshot` envelope, compiles it through the normal Compiler, and
  renders it in an isolated `PreviewRuntimeHostFrame`. Adapter and compilation
  results publish only when both the request identity and selected template
  still match; stale or unmounted results are discarded.
- Project creation completes catalog, adapter, Registry, schema, and compiler
  preflight before calling `ProjectRepository.create`. Page creation is one
  `page.add` Project Command against the current `ProjectEditorSession`, so it
  produces at most one edit version/history entry and one Undo removes it.
  A failed or stale creation preserves the active session and workspace choice.
  After Repository create, recovery storage, coordination, and persistence are
  prepared before publishing the adapter or editor session. Failure before
  activation compensates by deleting the new entity; compensation failure is
  reported explicitly and leaves that entity recoverable. Failure while
  refreshing the project catalog or recovery-draft list after activation must
  not delete or roll back the active project.
- Template instantiation uses one shared pure identity-remap function. Default
  identities retain a readable source prefix and add a UUID. Node, edge, and
  reaction identities are remapped from their formal owning scopes. Only
  typed identity references are rewritten; opaque business metadata is never
  searched or replaced heuristically.
- Provider seeds and instantiated projects/pages are defensively cloned. No
  mutable object may be shared between the provider, preview candidate,
  created instance, or another instantiation.

### 12.4 Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Provider rejects or returns a non-array / more than 256 entries | Isolate that Provider as `TEMPLATE_PROVIDER_FAILED`; keep other Providers available |
| Any seed array contains more than 4096 items | Reject that seed as `TEMPLATE_INVALID` before recursive parsing |
| Manifest version is missing or differs from the current literal | Reject as `TEMPLATE_VERSION_INVALID`; do not infer the format from fields |
| Manifest order is negative or fractional | Reject as `TEMPLATE_INVALID` |
| Seed contains a dangerous key, function, cycle, or unsupported identity reference | Reject before eligibility analysis, preview, or creation |
| Adapter / Registry lock is incompatible | Keep the template browsable; publish a diagnostic and disable creation |
| Persistence preparation fails after Repository create | Preserve the active session, delete the new entity, close staged resources, and report failure |
| Compensating delete fails | Preserve the entity for recovery and report both activation and rollback failure |
| Project list or recovery-draft refresh fails after activation | Keep the new project active and report the refresh error without rollback |
| Page command fails | Preserve page, history, editVersion, selection, and workspace choice |

### 12.5 Good / Base / Bad Cases

- Good: preflight a template, persist it, prepare recovery/persistence resources,
  activate one editor session, then refresh project and draft projections.
- Base: one Provider fails while another returns valid templates; the catalog
  publishes the valid entries plus a Provider-scoped diagnostic.
- Bad: publish the new session before recovery storage opens, then delete its
  Repository entity when that late preparation fails.

### 12.6 Tests Required

- Catalog tests cover malformed/non-JSON provider data, dangerous and duplicate
  ids, exact current version, old/future/missing versions,
  provider failure, stable sorting, eligibility diagnostics, and seed
  immutability. Boundary tests accept exactly 256 Provider entries and 4096
  seed array items, then reject 257/4097 before deep traversal.
- Identity tests cover two instances that reuse node and reaction ids, and
  verify every typed reference after remapping.
- Component tests cover search/filter/empty recovery, roving selection,
  mobile Details-to-Catalog Escape, focus restoration, ineligibility, and
  stale preview completion order.
- Controller tests cover activation-preparation compensation, compensation
  failure, preservation of an existing session/adapter, and post-activation
  refresh failure without rollback.
- Browser tests cover both adapters, project/page creation, one-command page
  history, return focus, 1440/900/390 layouts, Light/Dark contrast, long
  Registry diagnostics, both locales, and axe.

### 12.7 Wrong vs Correct

Wrong:

```ts
await repository.create({ document: project })
publishProjectSession(project)
await openRecoveryStore() // failure now leaves a published orphan session
```

Correct:

```ts
await repository.create({ document: project })
try {
  const prepared = await prepareProjectActivation(project)
  activateProjectSession(prepared)
}
catch (error) {
  await repository.delete(project.id)
  throw error
}
```

The production implementation must also close partially prepared resources and
surface compensating-delete failure instead of replacing the original error.

## 13. Config Model JSON Import Ingress

### 13.1 Scope / Trigger

Apply this contract when changing Workbench Project/Surface JSON import, strict
version gates, creation-workspace diagnostics, isolated import preview, or the
Project/Surface JSON export scope. Import is an explicit Workbench ingress; it
is not Repository compatibility.

### 13.2 Signatures

```ts
prepareConfigImport(options: {
  source: string
  target: 'surface' | 'project'
  currentProject?: ProjectDocumentV6
}): Promise<PrepareConfigImportResult>

guardConfigImportSourceBytes(bytes: number): ConfigImportDiagnostic[]
guardCanonicalConfigImportBudgets(payload: {
  target: 'surface' | 'project'
  envelope: unknown
}): ConfigImportDiagnostic[]

const PROJECT_TRANSFER_VERSION = 1 as const
const SURFACE_TRANSFER_VERSION = 1 as const
const MAX_IMPORT_SOURCE_BYTES = 96 * 1024 * 1024
```

`PreparedConfigImport` is the only value allowed to cross from import analysis
into creation. A prepared Surface captures the host project identity/content
hash and carries its complete remapped dependency closure plus copied embedded
bytes. A prepared Project carries the validated remapped document and copied
embedded bytes.

### 13.3 Contracts

- Project creation accepts only `ProjectTransferEnvelopeV1`; Surface creation
  accepts only `SurfaceTransferEnvelopeV1`. Bare ProjectDocument, Surface,
  SurfaceGraph, old Page transfer, Vue, ZIP, HTML, JavaScript, old, missing,
  future, and mixed versions fail closed without shape guessing or migration.
- Processing order is raw UTF-8 byte gate -> `JSON.parse` -> iterative
  structure/key guard -> exact Project/Surface transfer discriminator ->
  canonical Surface/node budget -> Model strict async Reader -> exact
  adapter/Registry validation -> complete identity remap -> current Project
  validation -> complete Project compilation preview.
- The raw JSON safety ceiling is 96 MiB, leaving bounded envelope headroom above
  the canonical base64 expansion of the Model's 50 MiB decoded Resource total.
  Model remains the owner of Resource limits: 10 MiB per embedded Resource,
  256 embedded Resources, and 50 MiB decoded total. Workbench must not impose a
  smaller content limit that makes a Model-valid transfer impossible to import.
- Structural budgets remain depth 64, array length 4096, and 100000 total
  entries. Canonical budgets remain 128 Surfaces and 4096 nodes across the
  transferred Surface set. Count nodes only at
  `document.surfacesById[*].graph.nodesById` or
  `surfacesById[*].graph.nodesById`; metadata keys with the same spelling are
  opaque and excluded.
- Project import requires the full exact active Registry lock. Surface transfer
  carries exactly the closure component subset; adapter/version and every
  component contract/fingerprint must match the target Registry. Neither path
  rebuilds, widens, or repairs a source lock.
- Fresh maps cover Surface, node, field, Dataset, Resource, and interaction/rule
  identity before any reference is rewritten. The complete candidate is then
  validated and compiled; failure publishes no metadata, bytes, history, or
  selection.
- Project creation uses Repository create/open/delete compensation. Surface
  preparation captures the host project identity/content hash; stale analysis
  cannot publish. One successful Surface import enters the current editor
  session as one Model command and one Undo step.
- Surface embedded bytes are copied into editor-session staging before control
  returns to the caller. Recovery Draft reads staged bytes first. Autosave
  commits the imported metadata and staged bytes atomically, and Undo restores
  both the editor snapshot and persisted Repository state without reopening a
  new session or clearing history.
- JSON and source export scopes read the whole Project or current Surface from
  one pinned `ProjectCompilation`; copy, tree, download, and ZIP must not select
  different revisions. A missing selected Surface renders unavailable state
  rather than exporting an empty file.

### 13.4 Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Raw JSON is 96 MiB / first byte above | Accept the source byte gate / `IMPORT_SOURCE_TOO_LARGE` before file read or parse |
| Structure exceeds depth/array/entry budget or contains an unsafe key | Stable import diagnostic with escaped JSON path; no adapter load or preview |
| Project/Surface transfer is old, future, missing, mixed, or Page-era | Reject at discriminator/version; no inference, migration, or wrapper |
| Canonical closure has 128/129 Surfaces | Accept / `IMPORT_SURFACE_LIMIT_EXCEEDED` before Model Reader |
| Canonical closure has 4096/4097 nodes | Accept / `IMPORT_NODE_LIMIT_EXCEEDED` before Model Reader |
| Opaque metadata contains `surfacesById` or `nodesById` | Preserve it without adding to canonical counts |
| Embedded Resource is 10 MiB / first byte above, or total is 50 MiB / first byte above | Accept / Model `resource_content_invalid`; publish no partial bytes |
| Project Registry or Surface subset differs from active contracts | Reject before identity remap; never repair and continue |
| Surface analysis becomes stale before create | Reject with unchanged document, bytes, history, and selection |
| Surface import succeeds, then Undo runs once | Restore the pre-import editor and Repository state in the same session |

### 13.5 Good / Base / Bad Cases

- Good: read a current Surface closure, enforce exact canonical budgets, copy
  bytes, remap every typed identity, compile the full candidate, then submit one
  undoable command whose autosave atomically publishes metadata and bytes.
- Base: a no-Resource Project transfer carries `embeddedContents: []` and
  imports without invoking an embedded-byte reader.
- Bad: retain a 2 MiB Workbench gate, count arbitrary metadata keys, import a
  Page envelope, direct-commit and reopen after Surface import, or publish
  metadata before bytes are available.

### 13.6 Tests Required

- Exact and first-over-limit raw/structure/Surface/node/Resource boundaries,
  all unsafe keys, syntax, current/old/future/mixed transfer versions, and
  canonical metadata lookalikes.
- Project/Surface stringify -> prepare -> identity-normalized semantic round
  trips, plus arbitrary JSON and hostile getter/Proxy inputs proving no
  non-diagnostic exception escapes.
- Controller tests assert stale analysis is inert; successful Surface import
  increments history once; one Undo restores selection/document/Repository;
  caller byte mutation cannot alter staging; recovery/autosave publish the
  captured bytes atomically.
- Component/browser tests cover paste/file, current-version diagnostics,
  isolated preview, both adapters/locales/themes, responsive overflow,
  keyboard focus, accessible names/live regions, and missing pinned Surface
  export behavior.

### 13.7 Wrong vs Correct

Wrong:

```ts
if (sourceBytes > 2 * 1024 * 1024) reject()
const nodes = countPropertiesNamed(parsed, 'nodesById')
await repository.commit(imported)
await openProject(imported.id)
```

Correct:

```ts
guardConfigImportSourceBytes(sourceBytes)
guardCanonicalConfigImportBudgets({ target, envelope })
const prepared = await readCurrentTransfer(envelope)
await editorSession.dispatch(createSurfaceImportCommand(prepared))
```
