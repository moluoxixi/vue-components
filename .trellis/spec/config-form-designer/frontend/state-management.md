# Project-First ConfigForm State

## 1. Scope / Trigger

Apply this contract when changing the ConfigForm Model package, Workbench state,
Designer commands, project persistence, history, Preview projection, Flow
editing, or Source/Config export.

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
  save(): Promise<ProjectEditorSessionSaveResult>
}

interface ProjectSaveCoordinator {
  readonly snapshot: ProjectSaveCoordinatorSnapshot
  save(
    capture: { document: ReadonlyProjectDocument, cursor: string },
    currentCursor: () => string,
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

interface AppliedProjectTransaction {
  transaction: ProjectTransaction
  inverse: ProjectTransaction
  editVersion: number
  contentHash: string
  timestamp: number
}

interface PageGraph {
  version: 2
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
  flows?: ConfigFormFlow[]
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
  PageGraph, Registry, Flow, and schema validation before publication. Failure
  preserves the original snapshot, history, and revision.
- One accepted Command produces at most one editVersion and one history
  entry. Merge keys may combine adjacent history entries without changing
  transaction atomicity.
- Command IDs are idempotent inside ProjectDomainEngine. Reusing an ID with a
  different payload returns `PROJECT_COMMAND_ID_REUSED`.
- Semantic commands are JSON-safe. Node property removal uses explicit
  `patch.unset`; `undefined` is invalid in `patch.set` because JSON,
  postMessage, Worker, and persisted command logs discard it.
- `ProjectDocument` contains no repository revision or persistence timestamps.
  Repository commits use a separate stable commit ID and CAS against the saved
  repository revision. `ProjectSaveCoordinator` owns commit ID generation,
  repositoryRevision, savedCursor, saving, and persistence diagnostics. Commit
  IDs include a per-editor-session namespace so two tabs cannot both emit
  `<project>:save:1` and be mistaken for a payload replay.
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
  Flow projection changes send only values/reaction state; they must not clone
  or recompile the complete `PageCompilation`. A same-page revision keeps one
  runtime session and does not emit `page.mount` again.
- Each RuntimeHost realm loads provider CSS and owns its Teleport targets.
  Workbench theme CSS must not enter the iframe. Component events crossing the
  bridge are reduced to registered `{ nodeId, event }`; Runtime component
  instances and event args remain inside the realm.
- In the Workbench, the selected node's Registry events are authored through a
  single Inspector-to-Flow path. The Inspector emits the exact stable
  `{ nodeId, event }` target, the Flow dialog selects an existing matching Flow
  or creates one from that event source, and all edits still commit through
  Project Transactions. Workbench does not expose a second action-string event
  model beside Flow.
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
- Runtime form values, touched state, validation, Flow queues, outputs, traces,
  abort signals, panel state, selection, drag candidates, and Monaco models are
  transient session/UI state.
- Source and Config are read-only. They pin one immutable export revision;
  later design edits mark the session stale rather than partially replacing
  files.

## 5. Repository Boundary

- Repository storage may split Manifest, Page, and Resource entities. A
  `ConfigFormFlow` is owned by one `ProjectPage` as a sibling of its visual
  `PageGraph`, and both persist inside the same Page entity; project-wide
  automation requires a different future contract.
  The manifest references exact revisioned keys and checksums.
- `load` publishes only a complete validated `PersistedProjectEnvelope`. Missing entities,
  checksum drift, or mismatched project IDs return
  `PROJECT_REPOSITORY_CORRUPT`.
- `commit` writes new entities, the manifest, and commit receipt in one native
  atomic storage transaction.
- Repository open/load validates the current schema version and Registry lock.
  Unknown versions, records from other namespaces, incomplete entities, and
  ambiguous Flow ownership fail closed with `PROJECT_REPOSITORY_CORRUPT`.
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
| Repository CAS mismatch | `PROJECT_REVISION_CONFLICT`; preserve local edits |
| Two editor sessions save their first edit | Unique commit IDs; stale tab receives CAS conflict, not command reuse |
| Save succeeds while newer edits exist | Saved captured revision; local state remains dirty |
| Export generation fails | Preserve the previous complete export snapshot |

## 7. Tests Required

- Model unit tests cover current schema invariants, every Operation, semantic
  inverse, command expansion, multi-action final validation, merge, undo/redo,
  no-op revisions, structural sharing, and performance at 100/500/2000 nodes.
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
  source/origin/session/version/payloads, exercise model/submit/field/component
  events through the iframe, and prove provider Teleports plus Runtime computed
  styles stay inside the iframe across Workbench Light/Dark changes. Design
  tests additionally cover geometry sync, nested hit testing, pointer
  down/move/up/cancel, stable registration across slot moves, and candidate /
  drag-visual Runtime parity.

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

## 9. Readonly Export Snapshot Contract

### 9.1 Scope / Trigger

Apply this contract when changing Source/Config generation, the export dialog,
single-file download, ZIP assembly, generator versions, or `WorkspaceFile`.
Export is a reproducible-build boundary: every visible or downloaded artifact
must belong to one exact editor snapshot and generator implementation.

### 9.2 Signatures

```ts
interface ExportSnapshot {
  readonly compilation: ProjectCompilation
  readonly generatorVersion: string
  readonly source: ExportFileSet
  readonly config: ExportFileSet
}

interface CreateExportSessionOptions {
  capture: () => BuildExportSnapshotInput | undefined
  currentCompilation: () => ProjectCompilation | undefined
  currentGeneratorVersion?: () => string
}

function isExportSnapshotStale(
  snapshot: ExportSnapshot | undefined,
  current: ProjectCompilation | undefined,
  currentGeneratorVersion?: string,
): boolean
```

### 9.3 Contracts

- Snapshot identity includes `ProjectCompilation.key`, the complete committed
  or draft `ProjectCompilation.origin`, and `generatorVersion`. A semantic key
  match alone does not mean the authoring export is current.
- `sync()` may compare identities but must not call `capture()` or compile the
  whole project. Only opening or explicitly refreshing Export may generate
  files.
- Text and binary files are retained immutably. A binary `content` read returns
  a defensive `Uint8Array` copy; mutating it cannot change later reads or ZIP
  bytes.
- File preview, copy, single-file download, and ZIP use the same pinned
  `ExportFileSet`. Binary files are never coerced through a text getter.
- Config source preserves `ProjectDocument.schemaVersion`, `registryLock`, page
  graph version/props, complete `SlotItem.placement`, node authoring metadata,
  and Flow editor positions. Runtime-compatible numeric `span` may also be
  promoted, but it does not replace relation metadata.
- `__proto__`, `constructor`, and `prototype` are rejected by one shared Config
  object-key guard in both generation and current Model parsing.
- Object URLs are revoked on a later task after the anchor click. Synchronous
  revocation is forbidden because browsers may not have consumed the URL yet.

### 9.4 Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Current compilation is missing | Existing snapshot is stale; retain its files |
| Committed editVersion changes | Snapshot is stale even if semantic key is unchanged |
| Draft base version or draftId changes | Snapshot is stale |
| Generator version changes | Snapshot is stale |
| Refresh generation fails | Preserve the previous complete snapshot and report the error |
| Binary file is selected | Download exact bytes; text copy is disabled |
| Unsafe Config object key appears at any depth | Fail generation with key and nested path |
| Export entry path is absent | Reject the file set before publishing the snapshot |

### 9.5 Good / Base / Bad Cases

- Good: editing the model marks the open export stale, refresh atomically swaps
  Source, Config, Tree, and ZIP to the new origin and generator version.
- Base: switching files or Config Source/JSON/Tree views reads the existing
  pinned snapshot without recompilation.
- Bad: rebuilding only the selected file, pairing an old Config projection with
  a new Source project, returning a retained `Uint8Array`, or serializing binary
  content as an empty string.

### 9.6 Tests Required

- Unit: committed/draft origin and generator drift independently mark stale.
- Unit: mutating the source buffer or a returned binary buffer cannot change a
  subsequent read or archived bytes, including `0` and `255`.
- Unit: text/binary Blob MIME and bytes, requested filename, and deferred URL
  revocation are exact.
- Unit: Config source preserves graph props, nested placement, Registry lock,
  node metadata, and Flow positions; Babel parses every generated file.
- Unit: all three unsafe keys fail in nested objects, `defineField`, and value
  model generation.
- Integration: Element Plus and Ant Design Vue standalone projects install,
  type-check, and build from the pinned export.
- Browser: Source/Config dialogs show a real tree and read-only Monaco, download
  feedback succeeds, and the clean page has no warning/error logs.

### 9.7 Wrong vs Correct

Wrong:

```ts
const blob = new Blob([selectedFile.kind === 'text' ? selectedFile.content : ''])
URL.revokeObjectURL(url)
```

Correct:

```ts
downloadWorkspaceFile({
  file: snapshot.source.files[selectedPath]!,
  filename: selectedPath.split('/').at(-1)!,
})
// The shared helper copies binary bytes and revokes the URL asynchronously.
```
