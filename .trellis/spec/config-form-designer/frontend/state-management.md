# Project-First ConfigForm State

## 1. Scope / Trigger

Apply this contract when changing the ConfigForm Model package, Workbench state,
Designer commands, project persistence, history, Preview projection, Flow
editing, or Source/Config export.

`ProjectDocument` is the only persisted business content model in the Workbench.
`ProjectSnapshot` is its immutable editor envelope. `PersistedProjectEnvelope`
owns repository metadata. `LowCodePageModel`,
`DesignerDocument`, and `WorkspaceApplication` are legacy ingress or stateless
compatibility projections; they must not own a reducer, history, revision, or
repository in the normal Workbench path.

## 2. Canonical Data Flow

```text
ProjectRepository
  -> PersistedProjectEnvelope
     { document, repositoryRevision, entityRevisions, createdAt, updatedAt }
  -> ProjectSaveCoordinator (CAS / commit receipt / save state)

immutable ProjectSnapshot
  -> ProjectDomainEngine (Command / Transaction / History)
  -> ProjectEditorSession (application facade)

UI / plugin intent
  -> ProjectCommand
  -> resolveProjectCommand
  -> ProjectOperation[]
  -> AppliedProjectTransaction + semantic inverse + ProjectChangeSet
  -> ProjectDomainEngine

ProjectSnapshot
  -> ProjectCompilation { snapshot, registry, key, ir }
     -> Design compatibility projection (temporary)
     -> Runtime/Preview projection
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
- Application facades may expose a superset such as
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
- Public Designer entry points must forward the same candidate Runtime
  projection contract to the Canvas. A capability declared on
  `DesignerCommandControl` cannot be wired only by the Workbench-specific
  `DesignSurface` while the compatibility `ConfigFormDesigner` silently uses a
  second projection path.
- Pointer coordinates are transient overlay state. Moving the pointer inside
  one unchanged drop target may reposition the drag visual, but it must not
  invalidate or rebuild the structural candidate Runtime projection. Candidate
  compilation dependencies are the drag source, normalized drop target, base
  document identity, and Registry contract.
- Palette specimen styling must target Designer-owned wrapper classes. Broad
  descendant selectors such as `label`, `input`, or `button` are forbidden
  because the specimen is a real adapter Runtime and owns its internal DOM.
- Successful semantic compilation returns one immutable `ProjectCompilation`
  binding the compilation snapshot, Registry snapshot, compiler identity, and
  Canonical IR. Runtime, Preview, Source, and Export must not pair these inputs
  independently.
- The current page ID is Design/Workbench navigation state, not a
  ProjectDomainEngine or ProjectEditorSessionSnapshot field. Switching pages
  republishes the relevant projection but does not create a project revision or
  history entry.
- Component keys resolve through the Registry Contract. Arbitrary HTML tags,
  Vue component instances, icons, or functions never enter ProjectDocument.
- The Workbench may temporarily project a Project page to
  `LowCodePageModel -> DesignerDocument` for the existing DesignSurface. That
  projection is stateless and one-way. Designer operations are converted to
  `ProjectCommandAction`; the projected model is never written to a legacy
  repository.
- Pages and Export may temporarily receive a projected `WorkspaceApplication`.
  Generated files in that object are derived scaffold/output only and never
  enter ProjectDocument.
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
- Legacy Workspace records migrate once at repository ingress. Persisted
  `ProjectDocument` v3 records deterministically move `graph.flows` to sibling
  `ProjectPage.flows` and become v4 in memory; ambiguous dual ownership fails
  closed. Migration failure preserves the original record and does not write
  partial new state.
- Compatibility projections are forbidden from calling legacy repository
  `commit`, `saveDraft`, or application reducers.

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

- Model unit tests cover schema invariants, migration, every Operation, semantic
  inverse, command expansion, multi-action final validation, merge, undo/redo,
  no-op revisions, structural sharing, and performance at 100/500/2000 nodes.
- Repository tests cover atomic multi-key create/commit, checksums, missing
  entities, CAS across connections, command receipt replay, quota/partial
  failure, save-during-edit, and legacy migration preservation.
- Architecture boundary tests prove the Domain Engine does not import
  Repository, Vue, Designer, Workbench, current-page, or saving contracts and
  that the production Workbench controller cannot import legacy reducers.
- Workbench boundary tests prove Designer and Page Manager legacy operations
  become Project Commands and that projected legacy data cannot become the
  state source.
- Browser tests prove one visual design action advances one project revision,
  Undo/Redo use ProjectDomainEngine through ProjectEditorSession, page
  switching does not create history, and
  Preview/Export observe the same project revision.
- Designer regression tests cover every public Canvas host that accepts
  `DesignerCommandControl.previewRuntime`. Repeated pointer moves within the
  same normalized drop target call that projection once, while a target change
  creates a new projection.
- Browser tests click the geometry of real Design controls and prove that focus
  stays on the editor overlay, keyboard input cannot mutate Design values,
  nested nodes select the deepest registered Runtime rectangle, and the same
  component remains interactive in Preview. These checks must run for every
  supported UI adapter.

## 8. Wrong vs Correct

Wrong:

```ts
workspaceSession.dispatch({ type: 'page.model', operation })
application = applyWorkspaceApplicationOperation(application, updatePage)
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

Wrong: watch a generated file or DesignerDocument and parse it back into the
project.

Correct: derive Design, Preview, Config, Source, and file-tree projections from
the current immutable ProjectSnapshot.
