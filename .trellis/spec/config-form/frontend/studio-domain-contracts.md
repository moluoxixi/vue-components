# ConfigForm Studio Domain Contracts

## 1. Scope / Status / Trigger

This document is the current cross-package contract for ConfigForm Studio. Read
it before implementing or changing Surface assets, Dataset services, Prototype
Interaction, Experience sessions, import/export, Preview transport, generated
Source, or the related package boundaries.

Surface assets, ProjectDocument v8, SurfaceGraph v3, RuleSet v2,
Registry v3, Canonical IR v7, Compiler 8.0.0, transfer, Runtime Host v7, and
Prototype Runtime session v1 are current. Dataset/Resource authoring, business
materials, theme, the complete Studio asset/interaction UI, and both Source
file-set kinds are current. Each implementation task switches its owned readers
and writers atomically and must not expose a compatibility union.

The target product creates JSON-safe demos. Production HTTP, authentication,
asynchronous side effects, and business functions remain in exported/host
Vue/TypeScript. Normal Runtime `props.onX` behavior is preserved and remains
outside every persisted contract in this document.

## 2. Vocabulary and Ownership

| Term | Meaning | Owner |
| --- | --- | --- |
| Material | A creatable component type, setters, visual capabilities, and semantic triggers | Designer adapter Registry |
| SurfaceAsset | A persisted, reusable Page/Dialog/Drawer definition | Model |
| SurfaceGraph | The component graph owned by exactly one SurfaceAsset | Model |
| SurfaceInstance | One isolated execution of a SurfaceAsset in an Experience session | Prototype Runtime |
| Dataset | A project-level, runtime-readonly JSON object array | Model and shared Dataset services |
| Dataset view | Deterministic projection/filter/sort/page result | Shared Dataset services |
| Runtime Data Source | HTTP, cache, cancellation, and host data integration | Production Runtime code API |
| Prototype Interaction | JSON-safe state projection, value action, or primary UI action | Core/Model contract; Prototype Runtime execution |
| Business handler | Arbitrary HTTP, auth, async side effect, or business function | Exported/host Vue/TypeScript |
| Resource | Project-owned static file metadata and bytes addressed by stable ID | Model/Repository |

`SurfaceAsset` is not a Material. `SurfaceInstance` is not persisted. Dataset is
not Runtime Data Source. Prototype Interaction is not a component event or
business handler. Types and reference fields must preserve these distinctions.
The production Runtime Data Source names an HTTP result `response` throughout
its value-reference contract (`kind: 'response'`, `context.response`,
`$response`, and `usesResponse`); the removed event spelling is not accepted.

## 3. Target Signatures

The signatures document field ownership and discriminants. Concrete packages
may use branded string IDs, but they may not collapse distinct ID kinds.

### 3.1 Project and Surface assets

```ts
type SurfaceKind = 'page' | 'dialog' | 'drawer'

interface ControlledLength {
  value: number
  unit: 'px' | '%' | 'rem' | 'vw' | 'vh'
}

interface ResponsiveLength {
  desktop: ControlledLength
  tablet?: ControlledLength
  mobile?: ControlledLength
}

type ProjectThemeColor = string
type ProjectThemeSpacingKey = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
type ProjectThemeRadiusKey = 'sm' | 'md' | 'lg'
type ProjectThemeShadowKey = 'sm' | 'md' | 'lg'

interface ProjectThemeShadow {
  x: number
  y: number
  blur: number
  spread: number
  color: ProjectThemeColor
}

interface ProjectThemeV1 {
  version: 1
  colors?: Partial<Record<
    | 'primary'
    | 'success'
    | 'warning'
    | 'danger'
    | 'text'
    | 'textMuted'
    | 'canvas'
    | 'surface'
    | 'surfaceRaised'
    | 'border',
    ProjectThemeColor
  >>
  typography?: {
    family?: 'system' | 'sans-serif' | 'serif' | 'monospace'
    baseSize?: number
    lineHeight?: number
    bodyWeight?: 400 | 500 | 600 | 700
    headingWeight?: 400 | 500 | 600 | 700
  }
  spacing?: Partial<Record<ProjectThemeSpacingKey, number>>
  border?: {
    width?: number
    style?: 'solid' | 'dashed'
  }
  radius?: Partial<Record<ProjectThemeRadiusKey, number>>
  shadows?: Partial<Record<ProjectThemeShadowKey, ProjectThemeShadow>>
}

interface ProjectDocumentV8 {
  version: 8
  id: ProjectId
  name: string
  homeSurfaceId: SurfaceId
  surfaceOrder: readonly SurfaceId[]
  surfacesById: Readonly<Record<SurfaceId, ProjectSurface>>
  datasetOrder: readonly DatasetId[]
  datasetsById: Readonly<Record<DatasetId, ProjectDataset>>
  resources: Readonly<Record<ResourceId, ProjectResource>>
  theme: ProjectThemeV1
  registryLock: RegistryLock
  settings: ModelJsonObject
}

interface SurfaceGraphV3 {
  version: 3
  props: ModelJsonObject
  form: FormSettings
  root: readonly SlotItem[]
  nodesById: Readonly<Record<NodeId, SurfaceNode>>
}

type MaterialNodeKind = 'field' | 'layout' | 'element'
type MaterialSemanticTrigger =
  | 'activate'
  | 'submit'
  | 'rowActivate'
  | 'itemActivate'

interface MaterialDatasetBindingCapability {
  key: string
  projectionKinds: readonly DatasetProjection['kind'][]
}

interface MaterialResourceBindingCapability {
  key: string
  mediaTypes?: readonly string[]
}

interface MaterialCapabilitiesV3 {
  kind: MaterialNodeKind
  semanticTriggers: readonly MaterialSemanticTrigger[]
  stateProjectionProperties: readonly (readonly string[])[]
  datasetBindings: readonly MaterialDatasetBindingCapability[]
  resourceBindings: readonly MaterialResourceBindingCapability[]
}

interface SurfaceNodeBase {
  id: NodeId
  component: ComponentKey
  props: ModelJsonObject
  extensions?: ModelJsonObject
  datasetBindings?: Readonly<Record<string, DatasetReference>>
  resourceBindings?: Readonly<Record<string, StaticResourceReference>>
}

/** Public TypeScript name remains `RuleSet`; the current wire literal is v2. */
type RuleSetV2 = RuleSet & { version: 2 }

interface SurfaceFieldNode extends SurfaceNodeBase {
  kind: 'field'
  field: string
  label?: string
  defaultValue?: ModelJsonValue
  required?: boolean
  requiredMessage?: string
  validation?: RuleSetV2
  validateOn?: ValidateTrigger | readonly ValidateTrigger[]
}

interface SurfaceLayoutNode extends SurfaceNodeBase {
  kind: 'layout'
  slots: Readonly<Record<SlotName, readonly SlotItem[]>>
  valueScope?: Omit<ConfigFormValueScopeDefinition, 'nodeId' | 'parentId'>
}

interface SurfaceElementNode extends SurfaceNodeBase {
  kind: 'element'
}

type SurfaceNode =
  | SurfaceFieldNode
  | SurfaceLayoutNode
  | SurfaceElementNode

interface ProjectSurfaceBase {
  id: SurfaceId
  name: string
  graph: SurfaceGraphV3
  parameters: readonly SurfaceParameterDefinition[]
  outputs: readonly SurfaceOutputDefinition[]
  interactions: readonly PrototypeInteraction[]
}

interface ProjectPageSurface extends ProjectSurfaceBase {
  kind: 'page'
  route: string
}

interface ProjectDialogSurface extends ProjectSurfaceBase {
  kind: 'dialog'
  presentation: {
    kind: 'dialog'
    title: string
    width: ResponsiveLength
    mask: boolean
    close: {
      escape: boolean
      mask: boolean
      button: boolean
    }
  }
}

interface ProjectDrawerSurface extends ProjectSurfaceBase {
  kind: 'drawer'
  presentation: {
    kind: 'drawer'
    title: string
    placement: 'left' | 'right' | 'top' | 'bottom'
    size: ResponsiveLength
    mask: boolean
    close: {
      escape: boolean
      mask: boolean
      button: boolean
    }
  }
}

type ProjectSurface =
  | ProjectPageSurface
  | ProjectDialogSurface
  | ProjectDrawerSurface

interface SurfaceParameterDefinition {
  name: string
  required: boolean
  defaultValue?: ModelJsonValue
}

interface SurfaceOutputDefinition {
  name: string
}

interface ProjectEmbeddedResource {
  id: ResourceId
  name: string
  kind: 'embedded'
  fileName: string
  mediaType: string
  byteLength: number
  contentHash: string
}

interface ProjectUrlResource {
  id: ResourceId
  name: string
  kind: 'url'
  url: string
  mediaType?: string
  integrity?: string
}

type ProjectResource = ProjectEmbeddedResource | ProjectUrlResource

interface StaticResourceReference {
  resourceId: ResourceId
}

interface ResourceTransferContentV1 {
  encoding: 'base64'
  data: string
}

type ResourceTransferPayloadV1 =
  | {
    resource: ProjectEmbeddedResource
    content: ResourceTransferContentV1
  }
  | {
    resource: ProjectUrlResource
  }

interface ResourceTransferEnvelopeV1 {
  kind: 'config-form-resource'
  version: 1
  payload: ResourceTransferPayloadV1
}

type ResourceTransferReadResult =
  | { resource: ProjectEmbeddedResource, bytes: Uint8Array }
  | { resource: ProjectUrlResource }

interface ProjectTransferEnvelopeV1 {
  kind: 'config-form-project'
  version: 1
  document: ProjectDocumentV8
  embeddedContents: readonly {
    resourceId: ResourceId
    content: ResourceTransferContentV1
  }[]
}

interface ProjectTransferReadResult {
  document: ProjectDocumentV8
  embeddedBytesByResourceId: Readonly<Record<ResourceId, Uint8Array>>
}

interface ProjectEmbeddedResourceRead {
  projectId: ProjectId
  resourceId: ResourceId
  contentHash: string
}

interface ProjectTransferWriteInputV1 {
  document: Readonly<ProjectDocumentV8>
  readEmbedded(input: ProjectEmbeddedResourceRead): Promise<Uint8Array | undefined>
}

readResourceTransfer(
  input: unknown,
): Promise<ContractResult<ResourceTransferReadResult>>

readProjectTransfer(
  input: unknown,
): Promise<ContractResult<ProjectTransferReadResult>>

writeProjectTransfer(
  input: ProjectTransferWriteInputV1,
): Promise<ContractResult<ProjectTransferEnvelopeV1>>
```

Surface parameter and output names are unique within one asset and follow the
same stable identifier grammar as field aliases. Parameter values are immutable
for the lifetime of one instance. A named output carries one JSON value; the
opening binding decides how that value is projected into caller fields.

Page alone owns `route`. Dialog and Drawer alone own their discriminated
`presentation`. `homeSurfaceId` references a Page. `navigate` references only a
Page; `open` references only a Dialog or Drawer. Surface kind cannot change in
place after creation; replace the asset through an explicit destructive command
if product requirements ever permit conversion.

Page routes start with `/`, contain no query or fragment, and are globally
unique in one project. `surfaceOrder` is non-empty, contains at least one Page,
and contains every `surfacesById` key exactly once. `datasetOrder` may be empty;
it contains every `datasetsById` key exactly once, so an empty order with an
empty map is valid. Every Surface, Dataset, and Resource map key equals the
contained asset's `id`. Duplicate, missing, or extra order/map identities fail
the ProjectDocument Reader; only the Surface order/map pair must be non-empty.

`SurfaceNode` retains the field/layout distinction, graph props, form settings,
root/slot placement, field validation, extensions, and layout value scopes, and
adds `element` for non-value UI such as Text, Heading,
Icon, Image, Button, Link, Tag, Alert, Table, List, Empty, and Pagination. Such
materials must not invent a form `field` merely to enter the graph.

Required is a field-level baseline expressed only by `required` and
`requiredMessage`; it is not a RuleSet descriptor. RuleSet v2 carries general
base/refinement rules and rejects `kind: 'required'`. `requiredMessage` may be
retained while Required is off so author toggles do not destroy the draft text,
but it affects runtime validation only when the effective Required state is
true. A dynamic `required` projection overrides the static field baseline for
that runtime instance without rewriting the persisted node. `validateOn`
independently schedules Required and general rule validation.

RuleSet v2 has no `time` base. A Material whose declared value kind is `time`
may use field-level `required` / `requiredMessage` and `validateOn`, but its
`validation` must be absent; neither Designer, Compiler, Runtime, nor Source may
reinterpret the time string as a RuleSet `date`. The `date` base is reserved for
Materials that declare the `date` value kind.

For an inline static Select, an existing RuleSet base of `enum` or `literal` is
referentially coupled to `props.options`. Unique non-empty string values derive
the exact ordered `enum`; one non-string primitive derives `literal`. A Designer
options edit must re-derive that base in the same Project command, preserve the
remaining RuleSet members, and clear the complete `validation` when the next
options cannot be represented. The same command clears a default value that no
longer refers to an option. Options, default, and validation therefore produce
one revision/history item and one Undo restores the complete prior state.

The hard cut removes persisted low-level `bindings`, `conditions`, `reactions`,
page `runtime`, and dynamic `optionSource`. Component value/event binding stays
in code-authored Runtime/adapter Registry contracts; Studio state/value rules
live only in `ProjectSurfaceBase.interactions`; Runtime Data Source stays
code-authored outside Studio. There is no second persisted expression or data
binding channel.

The current graph contract is SurfaceGraph v3. Registry v3 records each
Material's `field | layout | element`
kind, semantic triggers, allowlisted state-projection property paths, and named
Dataset/Resource binding capabilities. A node's `datasetBindings` and
`resourceBindings` keys must exist in that Material capability, and each
Dataset projection kind/media type must be allowed there. Select may bind a
Dataset as a field; Table/List may bind one as elements. Inline static options
remain ordinary validated props until the author invokes the explicit “save as
Dataset” command. A resource ID is never hidden inside props or a provider
import string. Readers reject removed fields rather than translating them.
Studio Materials provides Material entries, authoring UI, and adapter
projections against this fixed v3 shape without defining a second capability
contract.

`ResponsiveLength` uses desktop/tablet/mobile inheritance consistent with form
layout: tablet inherits desktop and mobile inherits tablet. Values are finite
and positive; `%`, `vw`, and `vh` values cannot exceed 100. It is structured
data, not an arbitrary CSS length string.

Dialog/Drawer `presentation.mask === false` requires `close.mask === false`;
otherwise the unreachable close configuration fails validation. ESC, mask, and
the close button honor their individual flags, close only the top overlay
instance, discard any implicit result, and restore focus to that instance's
live opener. They never identify an instance by `surfaceId`.

`ProjectThemeV1` is the complete theme wire shape accepted by ProjectDocument
v8. Theme colors use canonical `#RRGGBB` or `#RRGGBBAA`; numeric typography,
spacing, border, radius, and shadow values are finite non-negative values in
pixels except unitless `lineHeight`. Unknown categories/keys and CSS text are
rejected. Surface Foundation owns this v1 Reader and an empty theme; Studio
Materials owns authoring controls and adapter projection without widening or
replacing the theme shape or the Foundation-owned Registry v3 capability shape.

Resource metadata is persisted in the project while bytes remain owned by the
Repository/storage adapter for `embedded` resources. `fileName` is the stable
original leaf name used to derive generated asset paths; it is separate from
the author-renamable display `name`, is NFC-normalized and 1-255 UTF-8 bytes,
contains no slash, backslash, NUL, or control character, is neither `.` nor
`..`, and ends with `.[A-Za-z0-9]{1,16}`. `contentHash` is exactly
`sha256:<64 lowercase hex>` over raw bytes. A `url` resource stores an explicit
static URL and optional integrity metadata; it does not imply a Runtime request
lifecycle. Surface nodes and Source requests use only `resourceId`; they do not
persist object URLs, absolute filesystem paths, or provider-specific import
strings. Missing resources fail reference validation.

An embedded Resource export uses `ResourceTransferEnvelopeV1` and includes
RFC 4648 canonical padded base64 with no whitespace or data-URL prefix. Decoded
length and SHA-256 must match `byteLength` and `contentHash`; a URL Resource
envelope contains no `content`. URL values must be HTTPS or project-root-
relative and must reject `javascript:`, `data:`, `file:`, object-URL schemes,
credentials, and backslash traversal. `readResourceTransfer` accepts exact v1,
decodes into a fresh byte array, and performs all validation before success.

Resource transfer v1 permits at most 10 MiB decoded bytes for one embedded
resource. Project transfer v1 permits at most 256 embedded resources and 50 MiB
decoded bytes in aggregate. `ProjectTransferEnvelopeV1` is the lossless full-
project JSON shape: every embedded resource in `document.resources` has exactly
one matching `embeddedContents` item, every URL resource has zero, and duplicate,
missing, extra, length-mismatched, or hash-mismatched content fails the whole
Reader. The ProjectDocument remains metadata-only; project import commits its
validated document and returned byte snapshot atomically.

`writeProjectTransfer` first validates the complete current ProjectDocument,
then visits embedded Resources in ascending `resourceId` order and calls
`readEmbedded` with the exact project/resource/hash identity. URL Resources are
never read. It copies and validates every byte array before emitting canonical
padded base64 in the same order; no embedded Resource produces
`embeddedContents: []` and zero reads. Missing, rejected, thrown, stale,
length/hash-invalid, or over-budget bytes return `resource_content_invalid`
with no partial envelope. `readProjectTransfer` returns fresh byte arrays, so a
write -> JSON -> read round trip is lossless without sharing mutable buffers.

`registryLock` remains the single persisted owner of the locked adapter
identity, Registry version/fingerprint, and component locks. The document does
not add a parallel `adapter` field. Full provider metadata remains outside the
document and is read by the Studio composition root only when it constructs a
Source component resolver and ConfigForm binding resolver. `settings` remains
the project-level JSON-safe settings boundary. `SurfaceGraphV3` retains graph
props, form settings, root slot
placement, and the node table; the Surface migration must not reduce the graph
to a root-ID list.

### 3.2 Surface instances and sessions

```ts
interface SurfaceInstance {
  instanceId: SurfaceInstanceId
  surfaceId: SurfaceId
  parentInstanceId?: SurfaceInstanceId
  openerAddress?: PrototypeNodeAddressV1
  openerInteractionId?: InteractionRuleId
  parameters: Readonly<ModelJsonObject>
  values: ModelJsonObject
  runtime: PrototypeInstanceRuntimeSnapshotV1
  projection: PrototypeInstanceProjectionV1
}

interface PrototypeSessionV1 {
  version: 1
  projectId: ProjectId
  pageHistory: readonly SurfaceInstanceId[]
  overlayStack: readonly SurfaceInstanceId[]
  instancesById: Readonly<Record<SurfaceInstanceId, SurfaceInstance>>
}

interface PrototypeNodeAddressV1 {
  nodeId: NodeId
  scope: ConfigFormScopePath
}

interface PrototypeSurfaceTopologyV1 {
  nodeOrder: readonly NodeId[]
  ownerScopeIdByNodeId: Readonly<Record<NodeId, NodeId | null>>
  valueScopes: readonly ConfigFormValueScopeDefinition[]
  scopedFields: readonly ConfigFormScopedFieldDefinition[]
}

interface PrototypeFieldInstanceAddressV1 {
  address: PrototypeNodeAddressV1
  valuePath: readonly (string | number)[]
}

interface PrototypeInstanceRuntimeSnapshotV1 {
  nodeAddresses: readonly PrototypeNodeAddressV1[]
  fieldInstances: readonly PrototypeFieldInstanceAddressV1[]
}

interface PrototypeSurfaceContractBaseV1 {
  id: SurfaceId
  initialValues: Readonly<ModelJsonObject>
  parameters: readonly SurfaceParameterDefinition[]
  outputs: readonly SurfaceOutputDefinition[]
  interactions: readonly PrototypeInteraction[]
  topology: PrototypeSurfaceTopologyV1
}

type PrototypeSurfaceContractV1 =
  | (PrototypeSurfaceContractBaseV1 & {
      kind: 'page'
      route: string
    })
  | (PrototypeSurfaceContractBaseV1 & {
      kind: 'dialog'
      presentation: ProjectDialogSurface['presentation']
    })
  | (PrototypeSurfaceContractBaseV1 & {
      kind: 'drawer'
      presentation: ProjectDrawerSurface['presentation']
    })

interface PrototypeProjectContextV1 {
  version: 1
  projectId: ProjectId
  homeSurfaceId: SurfaceId
  surfacesById: Readonly<Record<SurfaceId, PrototypeSurfaceContractV1>>
}

interface PrototypeNodeProjectionV1 {
  address: PrototypeNodeAddressV1
  states: Readonly<Partial<Record<
    'visible' | 'disabled' | 'readonly' | 'required',
    boolean
  >>>
  properties: readonly {
    path: readonly string[]
    value: ModelJsonValue
  }[]
}

type PrototypeInstanceProjectionV1 = readonly PrototypeNodeProjectionV1[]

type PrototypeSessionCommand =
  | {
      type: 'instance.valuesChanged'
      instanceId: SurfaceInstanceId
      values: ModelJsonObject
      runtime: PrototypeInstanceRuntimeSnapshotV1
      originScope: ConfigFormScopePath
      changedAddresses: readonly PrototypeNodeAddressV1[]
    }
  | {
      type: 'interaction.activate'
      sourceInstanceId: SurfaceInstanceId
      sourceAddress: PrototypeNodeAddressV1
      interactionId: InteractionRuleId
      nextInstance?: {
        instanceId: SurfaceInstanceId
        runtime: PrototypeInstanceRuntimeSnapshotV1
      }
      item?: Readonly<ModelJsonObject>
    }
  | { type: 'history.back' }
  | {
      type: 'overlay.dismiss'
      instanceId: SurfaceInstanceId
      reason: 'escape' | 'mask' | 'button'
    }
  | { type: 'overlay.closeAll' }

type PrototypeSessionEffect =
  | {
      type: 'instance.mount'
      instanceId: SurfaceInstanceId
      surfaceId: SurfaceId
    }
  | { type: 'instance.dispose', instanceId: SurfaceInstanceId }
  | {
      type: 'instance.values.replace'
      instanceId: SurfaceInstanceId
      values: ModelJsonObject
      changedAddresses: readonly PrototypeNodeAddressV1[]
    }
  | {
      type: 'instance.projection.replace'
      instanceId: SurfaceInstanceId
      projection: PrototypeInstanceProjectionV1
    }
  | {
      type: 'focus.restore'
      instanceId: SurfaceInstanceId
      address: PrototypeNodeAddressV1
    }

interface PrototypeSessionResult {
  session: PrototypeSessionV1
  diagnostics: readonly PrototypeDiagnostic[]
  effects: readonly PrototypeSessionEffect[]
}

initializePrototypeSession(
  input: {
    projectId: ProjectId
    homeInstance: {
      instanceId: SurfaceInstanceId
      runtime: PrototypeInstanceRuntimeSnapshotV1
    }
  },
  context: PrototypeProjectContextV1,
): PrototypeSessionResult

reducePrototypeSession(
  session: PrototypeSessionV1,
  command: PrototypeSessionCommand,
  context: PrototypeProjectContextV1,
): PrototypeSessionResult
```

Entering or navigating to a Page creates a Page instance and page-history entry.
Opening a Dialog/Drawer creates a new overlay instance even if the same asset is
already open. Values, validation, focus, parameters, and result ownership are
isolated by `instanceId`, never cached by `surfaceId` alone.

`instancesById` contains exactly the live instances referenced by `pageHistory`
or `overlayStack`; each map key equals the contained `instanceId`. Any transition
that closes an instance removes its stack/history entry and map entry in the
same reducer result and releases its values, validation, focus, and parameter
state. No closed or unreachable instance may remain as a cache.

Page instances omit `parentInstanceId`, `openerAddress`, and
`openerInteractionId` together. Overlay instances contain all three: the parent
must be live, the node plus value-scope path is the exact focus/result target,
and the interaction ID names the `open` binding on the parent Surface whose
address, semantic trigger, and target created this instance. A named result
resolves `onResults` through that interaction ID and resolves field targets from
the opener scope. Missing, mismatched, ambiguous, or no-longer-live opener
identity rejects the result transaction and leaves the session unchanged.

The project context, session, and command each have strict current-version
Readers. Context map keys equal Surface IDs, the home Surface is a Page, and
interaction IDs are unique inside one Surface. Context also carries the compiled
value-scope topology: stable node order, each node's owner scope, scoped fields,
and value-scope definitions. A host uses the DOM-free value-scope store and an
injected row-ID factory to create an exact runtime snapshot of live node/field
addresses before initialization or instance creation. The caller supplies every
new instance ID. `interaction.activate.nextInstance` is required exactly for an
`open` or `navigate` action and forbidden for every other action. The reducer
never generates identity, reads mutable project state, or accepts a command-
supplied target, parameter binding, or result mapping.

Every activation names a live `sourceAddress`; binding node ID and address node
ID must match. Value-change commands carry the complete validated values,
current runtime snapshot, and exact changed addresses. A ValueAction or
ResultAssignment resolves its field NodeId against the trigger/opener scope and
compiled topology: root targets use the empty scope, ancestor targets use the
matching scope prefix, and a missing, descendant, or ambiguous target aborts the
whole transition. All changed addresses in one command must be live field
addresses resolvable from one explicit `originScope`; unrelated row changes are
dispatched as separate commands in occurrence order. Value rules evaluate and
settle once in that origin scope. Projection entries and focus effects also use
exact node addresses rather than NodeId alone.

For `rowActivate` and `itemActivate`, the Vue host fresh-clones the activated
readonly Dataset-view row into `interaction.activate.item`; that item is
required and JSON-safe. It is forbidden for `activate` and `submit`. The item
exists only for that immediate activation and may feed parameter/action
expressions; it is never retained in a Surface instance, session, or effect.
`onResults` executes later and therefore may not reference `item`; it may read
caller values/parameters and the returned `result` only.

The reducer is the sole StateProjectionRule evaluator. Each instance stores a
JSON-safe, address-scoped projection of dynamic overrides; Material static
props/states remain in the compiled artifact. Initialization, open, and navigation establish values
and immutable parameters, then compute projection without running value or UI
actions. User-value and named-result transactions settle all value rules first,
then recompute every live target address using that address's scope-local values.
Expression failure rolls back
the whole transition. Vue consumes the ordered `instance.projection.replace`
effect and never implements a second projection evaluator.

A Vue host executes a binding's validation gate before dispatching
`interaction.activate`; validation failure dispatches nothing. The host is also
the sole ordered executor of returned effects. Transport and parent UI may
observe the session and diagnostics but never replay mount, dispose, value, or
focus effects. Invalid commands return the identical prior session with stable
diagnostics and an empty effect list.

There is no static overlay-depth limit. User activation may produce A -> B -> A
or any other finite stack. Session/project initialization must not dispatch a
primary UI action, so automatic recursive opening is impossible. Compilers
compile each Surface asset once and retain references by ID; they do not recurse
through open targets.

### 3.3 Dataset and Dataset views

```ts
interface ProjectDataset {
  id: DatasetId
  name: string
  description?: string
  rows: readonly ModelJsonObject[]
  defaultProjection?: DatasetProjection
}

type DatasetProjection =
  | {
    kind: 'options'
    labelPath: readonly string[]
    valuePath: readonly string[]
    disabledPath?: readonly string[]
  }
  | {
    kind: 'table'
    rowKeyPath: readonly string[]
    columns: readonly {
      key: string
      valuePath: readonly string[]
    }[]
  }
  | {
    kind: 'list'
    itemKeyPath: readonly string[]
    titlePath?: readonly string[]
    descriptionPath?: readonly string[]
  }

interface DatasetReference<T extends DatasetProjection = DatasetProjection> {
  datasetId: DatasetId
  projection: T
  query?: DatasetViewQuery
}

interface DatasetViewQuery {
  filter?: SafeExpressionV1
  sort?: readonly {
    path: readonly string[]
    direction: 'asc' | 'desc'
  }[]
  page?: {
    index: number
    size: number
  }
}

interface DatasetViewResult<T> {
  items: readonly T[]
  total: number
}

interface DatasetTransferEnvelopeV1 {
  version: 1
  dataset: ProjectDataset
}

readDatasetTransfer(input: unknown): ContractResult<DatasetTransferEnvelopeV1>

createDatasetFromRows(input: {
  id: DatasetId
  name: string
  rows: unknown
}): ContractResult<ProjectDataset>
```

Dataset rows must be a root JSON array and every item must be a JSON object.
Nested objects and arrays are allowed. The shared Dataset layer owns row
validation, safe path access, projection, filter, stable sort, and pagination.
Options/Table/List materials consume the view and own rendering, selection,
visual state, and semantic activation; they never implement local query engines.

Dataset page indexes are zero-based and page size is a positive integer.
`total` is the filtered count before pagination. Sorting is stable: rules apply
in declaration order and rows equal under all rules keep source order. Query
evaluation never mutates source rows or their nested values.

For an `options` projection, every `valuePath` result must exist, be a unique
`string | number`, and remain stable for the evaluated Dataset snapshot. Missing
paths, duplicates, and `null`/boolean/object/array values emit
`dataset_projection_invalid` and block Experience and Source. Labels and
disabled state use their declared paths and do not weaken the value invariant.

Selection is not Dataset state. Form values keep explicit primitives such as
string/number IDs rather than implicitly storing a whole row. Dataset rows are
runtime-readonly in Experience and generated Source.

`readDatasetTransfer` and `createDatasetFromRows` are intentionally separate.
The Reader requires the exact versioned envelope and rejects a bare array.
Raw-row ingestion accepts only a bare JSON-object array and creates a current
ProjectDataset asset; export wraps that asset in the v1 envelope. Ingestion is a
user command, not compatibility behavior. Static options may call that creation
command after explicit mapping and confirmation.

### 3.4 Safe expressions

```ts
type SafeExpressionReferenceScope =
  | 'values'
  | 'parameters'
  | 'result'
  | 'item'

type SafeExpressionFunction =
  | 'coalesce'
  | 'length'
  | 'trim'
  | 'lower'
  | 'upper'
  | 'includes'
  | 'startsWith'
  | 'endsWith'

type SafeExpressionNode =
  | { kind: 'literal', value: ModelJsonValue }
  | {
    kind: 'reference'
    scope: 'values'
    selector?: ConfigFormScopeSelector
    path: readonly string[]
  }
  | {
    kind: 'reference'
    scope: Exclude<SafeExpressionReferenceScope, 'values'>
    path: readonly string[]
  }
  | { kind: 'array', items: readonly SafeExpressionNode[] }
  | {
    kind: 'unary'
    operator: '!' | '-' | '+'
    operand: SafeExpressionNode
  }
  | {
    kind: 'binary'
    operator:
      | '+' | '-' | '*' | '/' | '%'
      | '==' | '!=' | '>' | '>=' | '<' | '<='
      | '&&' | '||'
    left: SafeExpressionNode
    right: SafeExpressionNode
  }
  | {
    kind: 'conditional'
    test: SafeExpressionNode
    consequent: SafeExpressionNode
    alternate: SafeExpressionNode
  }
  | {
    kind: 'call'
    callee: SafeExpressionFunction
    args: readonly SafeExpressionNode[]
  }

interface SafeExpressionV1 {
  version: 1
  ast: SafeExpressionNode
}
```

Persisted expressions use the AST, not executable source. References use
explicit scopes and path segments so project import can remap IDs structurally.
Calls use the fixed pure-function allowlist; adapters and projects cannot inject
functions. Assignment, constructors, global lookup, dynamic member names,
prototype access, I/O, time, randomness, and arbitrary JavaScript are invalid.

`item` is available only while evaluating a Dataset row. `result` is available
only inside an atomic named-result mapping. Invalid scope use fails validation
before Experience or Source generation.

A `values` reference resolves from the evaluator's scoped node address. Its
optional selector is `current | parent | root` and defaults to `current`, using
the same value-scope semantics as Core. At root, `parent` resolves to root.
Selectors are forbidden on `parameters`, `result`, and `item` references.

Safe Expression v1 has one deterministic evaluator contract:

- The AST contains at most 256 nodes, has maximum depth 32, and each reference
  path contains at most 32 non-empty segments. Readers reject larger trees.
- Reference traversal reads own properties only. `__proto__`, `prototype`, and
  `constructor` are forbidden path segments. A missing segment produces an
  internal `missing` sentinel; only `coalesce` may absorb it. Any other use of
  `missing` is `interaction_expression_invalid`, never JavaScript `undefined`.
- `==` and `!=` perform type-strict deep JSON equality: arrays are ordered and
  objects compare the same own-key/value set independent of insertion order.
  Ordered comparison accepts only number/number or string/string; strings use
  deterministic UTF-16 code-unit order. There is no coercion.
- `&&` and `||` require booleans, short-circuit left to right, and return a
  boolean. Conditional tests and every state/condition expression must also
  return a boolean; JavaScript truthiness is never used.
- Unary `+`/`-` and arithmetic operators accept finite numbers only. Division
  or modulo by zero and every NaN/Infinity/non-finite result emit
  `interaction_expression_invalid`.
- `coalesce` evaluates left to right, skips `missing` and `null`, and returns
  the first present JSON value or `null`. `length` accepts a string or array.
  `trim`/`lower`/`upper` accept one string. `startsWith`/`endsWith` accept two
  strings. `includes` accepts string/string or array/JSON-value and uses the
  same deep equality for array items. Wrong arity/type is invalid.
- Every literal, function argument, and evaluator result is JSON-safe; numbers
  are finite and no function may return `undefined`, a class instance, a
  function, a symbol, or any adapter-owned value.

### 3.5 Prototype Interaction

```ts
type PrototypeInteraction =
  | StateProjectionRule
  | ValueChangeRule
  | PrimaryUiActionBinding

type StateProjectionTarget =
  | {
    kind: 'state'
    nodeId: NodeId
    key: 'visible' | 'disabled' | 'readonly' | 'required'
  }
  | {
    kind: 'property'
    nodeId: NodeId
    path: readonly string[]
  }

interface StateProjectionRule {
  kind: 'stateProjection'
  id: InteractionRuleId
  target: StateProjectionTarget
  value: SafeExpressionV1
}

type ValueAction =
  | {
    kind: 'set'
    targetFieldId: NodeId
    value: SafeExpressionV1
  }
  | {
    kind: 'copy'
    sourceFieldId: NodeId
    targetFieldId: NodeId
  }
  | {
    kind: 'clear'
    targetFieldId: NodeId
  }

interface ValueChangeRule {
  kind: 'valueChange'
  id: InteractionRuleId
  dependencies: readonly NodeId[]
  when?: SafeExpressionV1
  action: ValueAction
}

interface ValidationGate {
  scope: 'surface' | 'fields'
  fieldIds?: readonly NodeId[]
}

interface SurfaceParameterBinding {
  name: string
  value: SafeExpressionV1
}

interface ResultAssignment {
  targetFieldId: NodeId
  value: SafeExpressionV1
}

interface NamedResultBinding {
  resultName: string
  assignments: readonly ResultAssignment[]
}

type PrimaryUiAction =
  | {
    kind: 'navigate'
    targetSurfaceId: SurfaceId
    parameters: readonly SurfaceParameterBinding[]
  }
  | { kind: 'back' }
  | {
    kind: 'open'
    targetSurfaceId: SurfaceId
    parameters: readonly SurfaceParameterBinding[]
    onResults?: readonly NamedResultBinding[]
  }
  | {
    kind: 'closeCurrent'
    result?: {
      name: string
      value: SafeExpressionV1
    }
  }
  | { kind: 'closeAll' }

interface PrimaryUiActionBinding {
  kind: 'primaryUiAction'
  id: InteractionRuleId
  nodeId: NodeId
  trigger: MaterialSemanticTrigger
  validate?: ValidationGate
  action: PrimaryUiAction
}
```

State projection is pure and runs on initialization and after dependency
changes. A property target must be declared in the Material's projection
allowlist; arbitrary prop paths fail registration or project validation. A
Surface may contain at most one state-projection rule for the same normalized
node/state key or node/property path. When that rule exists, its evaluated value
overrides the static baseline; state targets require a boolean, and property
targets require a JSON value accepted by the Material capability.

Value rules establish an initial baseline without applying actions. One rule
contains exactly one `set`, `copy`, or `clear` action and runs only after a
declared dependency changes through user input or a named-result transaction.
A dependency, copy source, action target, and result-assignment target must
reference a `SurfaceFieldNode`; a value-scope owner layout or non-value element
is never an implicit writable field.
Affected rules settle in one deterministic transaction. Cycles abort the whole
transaction; partial values are not published. Candidate rules execute in their
`ProjectSurfaceBase.interactions` declaration order against staged values. When
several rules write the same target, validation emits a stable warning and the
last staged write wins; this order is preserved by import/export and Source.

A Material declares semantic trigger keys such as activate, submit, or
rowActivate. They are capabilities, not DOM event names. One node/trigger pair
has at most one `PrimaryUiActionBinding`, and that binding has exactly one
action. A validation gate precedes that action and cancels it on failure.

`navigate` targets Page only. `open` targets Dialog/Drawer only. Parameter names
must match the target definitions and required values must resolve. Named-result
bindings have unique result names and each name must be declared by the target
Surface. Assignments for the returned name form one atomic caller-value
transaction, not an action chain; after commit, normal value and state
reevaluation runs. An unbound declared result closes normally without caller
writes. An undeclared result is rejected before the session changes.

`navigate` creates a Page instance, appends it to page history, clears all
overlay instances, and removes those closed overlays from `instancesById`. When
an overlay is open, `back` closes only the top overlay, removes its instance,
discards any result, and restores focus to its opener. With no overlay, `back`
returns to the previous Page instance and removes the popped Page instance; with
no previous entry it leaves the session unchanged.
`closeCurrent` closes only the top overlay, removes its instance, and may publish
one named result to its live opener. It is invalid when no overlay is open.
`closeAll` clears the overlay stack and all corresponding map entries, discards
results, and never removes the active Page.
Closing or navigating never dispatches arbitrary component callbacks.

### 3.6 Source resolver

The current `@moluoxixi/config-form-source` package owns this provider-neutral
input contract:

```ts
interface SourceAdapterIdentity {
  adapter: string
  adapterVersion: string
  registryFingerprint: string
}

interface SourceComponentRequest {
  componentKey: ComponentKey
  contractVersion: string
  contractFingerprint: string
}

interface SourceLibraryResolution {
  packageName: string
  plugin: string
  version: string
  stylesheet?: string
}

interface SourceOptionsResolution {
  mode: 'prop' | 'children'
  optionTag?: string
  labelProp?: string
  valueProp?: string
}

interface SourceComponentResolution {
  moduleSpecifier: string
  importName: string
  tag: string
  configComponent: string
  render: 'component' | 'layout-flex' | 'layout-grid' | 'section'
  styleImports: readonly string[]
  dependencies: Readonly<Record<string, string>>
  semanticListeners?: Readonly<Partial<Record<MaterialSemanticTrigger, {
    event: string
    listenerProp: string
    item:
      | { kind: 'none' }
      | { kind: 'argument', index: number }
  }>>>
  library?: SourceLibraryResolution
  options?: SourceOptionsResolution
  staticProps?: ModelJsonObject
  defaultValue?: ModelJsonValue
  valueProp?: string
  trigger?: string
  blurTrigger?: string
}

interface SourceConfigFormBindingResolution {
  component: { moduleSpecifier: string, importName: string }
  model: { moduleSpecifier: string, importName: string }
  styleImports: readonly string[]
  dependencies: Readonly<Record<string, string>>
}

type SourceResolutionResult<T> =
  | { success: true, value: T }
  | { success: false, reason: string }

interface SourceComponentResolver {
  readonly adapter: SourceAdapterIdentity
  resolveComponent(
    request: SourceComponentRequest,
  ): SourceResolutionResult<SourceComponentResolution>
}

interface SourceConfigFormBindingResolver {
  resolveConfigFormBinding(): SourceResolutionResult<SourceConfigFormBindingResolution>
}

interface SourceResourceReader {
  readEmbedded(request: {
    projectId: ProjectId
    resourceId: ResourceId
    contentHash: string
  }): Promise<ContractResult<Uint8Array>>
}

interface SourceGenerationInputBase {
  compilation: ProjectCompilation
  componentResolver: SourceComponentResolver
  resourceReader: SourceResourceReader
}

interface GenerateVueSourceInput extends SourceGenerationInputBase {}

interface GenerateConfigFormBindingsInput extends SourceGenerationInputBase {
  bindingResolver: SourceConfigFormBindingResolver
}

type SourceLanguage = 'vue' | 'typescript' | 'json' | 'css' | 'scss' | 'text'

type SourceFile =
  | {
    kind: 'text'
    path: string
    language: SourceLanguage
    content: string
  }
  | {
    kind: 'binary'
    path: string
    mediaType: string
    encoding: 'base64'
    contentBase64: string
  }

interface SourceFileSetBaseV1<TKind extends 'raw-source' | 'config-bindings'> {
  version: 1
  kind: TKind
  entry: string
  files: readonly SourceFile[]
}

type RawSourceFileSetV1 = SourceFileSetBaseV1<'raw-source'>
type ConfigBindingFileSetV1 = SourceFileSetBaseV1<'config-bindings'>
type SourceFileSetV1 = RawSourceFileSetV1 | ConfigBindingFileSetV1

readSourceFileSet(input: unknown): ContractResult<SourceFileSetV1>

generateVueSource(
  input: GenerateVueSourceInput,
): Promise<ContractResult<RawSourceFileSetV1>>

generateConfigFormBindings(
  input: GenerateConfigFormBindingsInput,
): Promise<ContractResult<ConfigBindingFileSetV1>>
```

Studio reads the locked project adapter metadata only at its composition root,
constructs the component resolver and the ConfigForm binding resolver,
constructs a Repository-backed resource reader, and injects all three through
their separate responsibilities. Source does not import Designer, Workbench, an
Element/Ant adapter, provider UI, or a concrete Repository. Component and
binding resolution are deterministic for the same compilation and adapter
identity; failure returns a stable diagnostic instead of guessing an import.

`SourceAdapterIdentity` is projected from `ProjectDocumentV8.registryLock` as
`adapter`, `adapterVersion = registryLock.version`, and
`registryFingerprint = registryLock.fingerprint`; it is not a second adapter
selector. Each component request also carries the matching locked contract
version and fingerprint. `SourceComponentResolver` remains synchronous and maps
only provider components/imports; `SourceConfigFormBindingResolver` remains
synchronous and maps only the public ConfigForm binding imports. Raw generation
does not accept or observe the binding resolver. Every bare package specifier
returned for a component module, ConfigForm binding module, `styleImports`, or
`library.stylesheet` must have an own matching key in that resolution's
`dependencies` record with a portable version. Missing style dependencies fail
that generation call with `source_resolution_failed`; they must not be deferred
to installation of the generated project.
`semanticListeners` is provider-owned code-generation metadata, not a persisted
Studio event domain: `activate`/`submit` carry no component payload, while
`rowActivate`/`itemActivate` select one declared argument as the immediate
readonly item. The generator never forwards arbitrary arguments or emits a
handler registry.

`generateVueSource` returns a runnable Vue/Vue Router project with entry
`src/main.ts` that directly uses resolved provider components. Its
`package.json.dependencies` and application runtime bare-package import
whitelist is exactly `vue`, `vue-router`, and the selected target UI package returned by the
component resolver. Those locations must contain no `@moluoxixi/*`,
`@config-form/*`, ConfigForm, Zod, RuleSet converter, Compiler, or internal
Runtime dependency. Build-only `devDependencies` such as Vite, TypeScript, and
their plugins remain allowed. Each Surface receives
readable project-local validation TypeScript that implements field-level
Required/Required message, RuleSet v2 refinements, and `validateOn` without an
interpreter or copied runtime core.
`generateConfigFormBindings` returns configuration
modules with entry `src/bindings.ts`; it emits no App, main, router, page-history,
overlay host, session reducer, or generic action executor. It preserves
field-level Required and serializes RuleSet v2 as public ConfigForm binding
configuration rather than embedding ConfigForm's runtime implementation.

Each generation API runs its own complete preflight and file assembly. Both
preserve scoped initial values and fail before returning their own file set when
a rule, regex, type, or named custom validator cannot be represented. One API's
diagnostics do not erase a successful file set returned by the other API for the
same `ProjectCompilation`; Workbench represents them as independent
`ready | failed` artifacts bound to that compilation identity.
Nested scoped defaults and field rendering are supported. A compilation that
requires address-scoped interaction settlement, projection, or result assignment
that cannot yet be represented by the standalone generated app fails closed with
`source_input_invalid`; it must not silently flatten row-local state into root
values. Adding that capability requires a separate scope-address runtime contract
and executed Preview/Source parity coverage.

Embedded bytes are a separate asynchronous storage concern.
`SourceResourceReader.readEmbedded` addresses the exact content version by
project ID, resource ID, and hash, and returns a fresh byte copy. Source derives
`src/assets/<safe-resource-id>[collision-suffix].<lowercase-extension>` from the
stable ID and validated `fileName`, checks byte length and SHA-256, and encodes
canonical base64 itself. A URL
resource never calls the reader and is never fetched; generated code keeps its
validated static URL and emits no binary file. Provider failure emits
`source_resolution_failed`; missing or corrupt bytes emit
`source_resource_read_failed` or `resource_content_invalid`. Any failure resolves
that generator Promise with diagnostics and no partial `SourceFileSet`; it does
not define the result of a separate generation API invocation.

Paths in a SourceFileSet are unique normalized project-relative POSIX paths and
cannot contain `..`, absolute roots, drive prefixes, or NUL. Text is UTF-8;
binary content uses the explicit base64 variant and is never coerced into a
text `content` field. `files` is sorted by normalized path, and `entry` names one
existing text file. The readonly Viewer sends only text files to Monaco and
shows a non-editable binary-file state for binary selections.

Package root and `/generator` imports must work in Node without DOM globals.
Vue, Monaco, browser APIs, and styles belong only to `/viewer` and
`/viewer/style`. The Viewer uses a controlled required `selectedPath` v-model,
shows tree/code side by side on desktop and a tree/code switch on narrow
screens, and lazily loads Monaco. Viewer never owns export commands or
persistence.

## 4. Dependency and Reuse Contracts

```text
Core <- Headless <- Runtime <- UI adapters

Model -> Compiler -> Canonical IR -> Vue Backend -> Runtime
  ^                                      |
  |                                      v
Designer                         Prototype Runtime
  ^                                      ^
  |                                      |
Studio ----------------------------------+
  |
  +---- provider-neutral input --> Source
```

- `@moluoxixi/config-form-prototype-runtime` is the shared owner for
  page history, overlay instances, parameters/results, and UI-action reduction.
  Root and `/session` are DOM-free; `/vue` and `/vue/style` own Vue hosts,
  overlay integration, focus, and masks.
- Studio Experience uses that package. Generated raw source preserves the same
  observable behavior as readable application code without importing or copying
  its reducer/session model; bindings contain configuration only. Production
  Core/Headless/Runtime do not depend on it.
- Dataset validation and query execute in one shared pure service consumed by
  Preview and generated Source. Options/Table/List do not fork the algorithm.
- Source owns resolver input types; Studio owns adapter-metadata adaptation.
  Source and Designer do not depend on one another.
- Studio is a private composition root. Public packages never import it.

Source is a current public package with real implementation, manifest, README,
entries, architecture routing, generated-consumer gates, and release metadata.

## 5. Version and Atomic-Cut Contract

| Contract | Pre-cut baseline | Current / reviewed identity | Owning implementation task |
| --- | --- | --- | --- |
| RuleSet | `1` | `2` | config-form-validation-source-hardening |
| ProjectDocument | `7` | `8` | studio-datasets |
| SurfaceGraph | `2` | `3` | studio-datasets |
| Project theme | absent | `1` | surface-foundation; studio-materials consumes without widening |
| Registry snapshot | `2` | `3` | surface-foundation; studio-materials only adds entries/authoring mappings |
| Canonical Project IR | `6` | `7` | studio-datasets |
| Compiler | `7.0.0` | `8.0.0` | studio-datasets |
| IndexedDB manifest/entity codec | `3` | `4` | surface-foundation |
| Recovery Draft | `1` | `2` | surface-foundation |
| Page transfer / Surface transfer | `Page 2` | `Surface 1` | surface-foundation |
| Runtime Host protocol | `6` | `7` | surface-foundation |
| Project transfer | absent | `1` | surface-foundation; studio-datasets supplies embedded content |
| Dataset transfer | absent | `1` | studio-datasets |
| Resource transfer | absent | `1` | studio-datasets |
| Prototype session | absent | `1` | surface-foundation |
| SourceFileSet | absent | `1` | source-package |

Target numbers define the final reviewed identity. The first task owning a
Reader implements the complete target shape and removes the old one. A later
task does not increment or widen that Reader without returning to contract
review.

Every lower, higher, missing, malformed, and mixed version fails closed. No
legacy Page reader, pages/surfaces union, migration registry, compatibility
alias, deprecated wrapper, hidden flag, or combined peer range is allowed.
Historical tasks/changelogs may describe old identities; active README/spec/API
examples may not describe them as accepted input.

## 6. Stable Diagnostics

Diagnostics use stable `code` and structured `context`; localized messages are
display-only. Multiple diagnostics use deterministic asset-order, graph-order,
then rule-order sorting. Cross-package control flow never matches message text.

| Code | Required context | Result |
| --- | --- | --- |
| `unsupported_contract_version` | `contract`, `expected`, `received` | Reject Reader input |
| `project_structure_invalid` | `projectId`, `path`, `reason` | Reject project save/import/compile |
| `surface_graph_invalid` | `surfaceId`, `path`, `reason` | Reject Surface save/import/compile |
| `surface_presentation_invalid` | `surfaceId`, `path`, `reason` | Reject Surface save/import/compile |
| `project_theme_invalid` | `projectId`, `path`, `reason` | Reject project save/import/compile |
| `invalid_surface_reference` | `sourceSurfaceId`, `nodeId`, `targetSurfaceId` | Reject save/compile |
| `invalid_surface_kind` | `surfaceId`, `expectedKinds`, `receivedKind` | Reject home/action |
| `surface_in_use` | `surfaceId`, `references` | Block delete |
| `surface_parameter_invalid` | `targetSurfaceId`, `parameterName`, `reason` | Reject action before session mutation |
| `surface_result_invalid` | `surfaceId`, `resultName`, `reason` | Reject close/result transaction |
| `dataset_rows_invalid` | `datasetId`, `path`, `reason` | Reject raw creation/import |
| `dataset_reference_invalid` | `datasetId`, `surfaceId`, `nodeId`, `reason` | Reject save/compile/delete |
| `dataset_projection_invalid` | `datasetId`, `nodeId`, `path`, `reason` | Block Experience/Source |
| `resource_reference_invalid` | `resourceId`, `surfaceId`, `nodeId`, `reason` | Reject save/compile/delete |
| `resource_content_invalid` | `resourceId`, `path`, `reason` | Reject transfer/generation |
| `interaction_expression_invalid` | `surfaceId`, `ruleId`, `location` | Keep draft; suspend rule; block Experience/Source |
| `interaction_trigger_invalid` | `surfaceId`, `nodeId`, `trigger` | Reject binding |
| `interaction_target_conflict` | `surfaceId`, `target`, `ruleIds` | Reject duplicate state target |
| `interaction_write_conflict` | `surfaceId`, `targetFieldId`, `ruleIds` | Keep deterministic order; warn author |
| `interaction_cycle` | `surfaceId`, `ruleIds`, `fieldIds` | Abort value transaction |
| `prototype_instance_not_found` | `instanceId`, `action` | Leave session unchanged |
| `prototype_action_invalid` | `instanceId`, `action`, `reason` | Leave session unchanged |
| `source_resolution_failed` | `adapter`, `componentKey`, `reason` | Abort generation |
| `source_resource_read_failed` | `projectId`, `resourceId`, `contentHash`, `reason` | Abort generation |

An editor may retain an invalid draft for correction, but Experience and Source
must not run a project with blocking diagnostics. Runtime host functions are not
translated into these diagnostics.

## 7. Validation and Error Matrix

| Condition | Required result |
| --- | --- |
| `surfaceOrder` is empty or contains no Page | `project_structure_invalid`; reject project |
| `datasetOrder` and `datasetsById` are both empty | Accept the empty Dataset collection |
| An order/map pair has duplicate, missing, or extra IDs | `project_structure_invalid`; reject project |
| A Surface/Dataset/Resource map key differs from its value's `id` | `project_structure_invalid`; reject project |
| A Page route is empty, lacks leading `/`, has query/fragment, or duplicates another route | `project_structure_invalid`; reject project |
| `homeSurfaceId` targets Dialog/Drawer | `invalid_surface_kind`; reject project |
| An element node contains field-only members | `surface_graph_invalid`; reject instead of inventing a form field |
| RuleSet version is old/future/missing, or a rule uses `kind: 'required'` | Reject the field/document at its strict Reader; do not migrate Required into field settings |
| A `time` Material contains `validation`, including a `date` base | `surface_graph_invalid`; do not reinterpret time as date; keep only field Required and `validateOn` |
| Inline Select options change while validation uses `enum` or `literal` | Re-derive the base and clear any invalid default in the same command/revision/history item |
| New Select options cannot represent the existing enum/literal base | Unset the complete validation in that same command; do not retain a stale base or reject the options solely for this reason |
| A default value does not currently satisfy Required, length, range, format, or compare | Accept the editable artifact; enforce the rule only at its configured runtime trigger |
| A default value is incompatible with the declared RuleSet base type | Emit a structural type diagnostic and reject compilation |
| A graph contains removed `bindings`, `conditions`, `reactions`, `runtime`, or `optionSource` | `surface_graph_invalid`; reject instead of translating |
| A node binding key is absent from its Registry v3 capability | `surface_graph_invalid`; reject save/compile |
| A Dataset binding is dangling or uses a disallowed projection | `dataset_reference_invalid` or `dataset_projection_invalid`; reject save/compile |
| A Resource binding is dangling or uses a disallowed media type | `resource_reference_invalid`; reject save/compile |
| Dialog/Drawer has `mask: false` and `close.mask: true` | `surface_presentation_invalid`; reject unreachable policy |
| ESC, mask, or close button is enabled and activated | Close only the top overlay and restore focus to its opener |
| Responsive length has arbitrary CSS, invalid unit/range, negative, zero, NaN, or Infinity | `surface_presentation_invalid`; reject Surface |
| Theme has unknown keys, invalid colors, negative/non-finite values, or CSS text | `project_theme_invalid`; reject project |
| `navigate` targets Dialog/Drawer | `invalid_surface_kind`; do not change session |
| `open` targets Page | `invalid_surface_kind`; do not create an instance |
| Same Dialog is opened twice | Create two isolated instance IDs and value/validation states |
| User opens A -> B -> A | Permit the finite stack; do not recursively compile assets |
| Same node activates from two value-scope rows | Use its exact scoped address; never write/project/focus the sibling row |
| Runtime snapshot contains a stale, duplicate, or topology-invalid address | `prototype_session_invalid`; leave session unchanged |
| `rowActivate`/`itemActivate` omits item, or another trigger supplies item | `prototype_command_invalid`; leave session unchanged |
| An overlay closes, all overlays close, or navigation clears overlays | Remove every closed ID from `instancesById` and release its instance-owned state |
| Project load contains an automatic open action | Reject the initialization path |
| Required parameter is absent | `surface_parameter_invalid`; reject action before session mutation |
| Named result maps to several fields | Commit all assignments atomically, then reevaluate rules |
| Target returns a declared but unbound result | Close normally and leave caller values unchanged |
| Target returns an undeclared result | `surface_result_invalid`; reject before closing or mutating caller values |
| One result assignment fails | Commit none of the assignments |
| Value rule exists during initialization | Establish baseline; do not execute `set/copy/clear` |
| Declared dependency changes by user/result | Execute its one action in deterministic transaction order |
| Value rules form a cycle | Emit `interaction_cycle`; publish no partial values |
| Trigger has two primary UI actions | Reject binding; never execute an action array |
| `closeCurrent` runs with no overlay | `prototype_action_invalid`; leave session unchanged |
| `back` runs with overlays open | Close and remove only the top overlay, discard its result, and keep Page history unchanged |
| `back` runs with no overlay and prior Page history | Return to the previous Page instance and remove the popped Page instance |
| Expression uses a global/function outside allowlist | Emit `interaction_expression_invalid`; block Experience/Source |
| Expression reads inherited/forbidden prototype path or consumes missing outside `coalesce` | Emit `interaction_expression_invalid`; never expose `undefined` |
| Condition/state expression is non-boolean or arithmetic is non-finite | Emit `interaction_expression_invalid`; do not coerce or publish state |
| Two state rules target the same normalized target | Emit `interaction_target_conflict`; reject the duplicate target |
| Ordered value rules write one target | Emit `interaction_write_conflict`, execute in declaration order, and let the last staged write win |
| Dataset row is primitive/array | Emit `dataset_rows_invalid`; reject ingestion |
| Envelope Reader receives raw object rows | `unsupported_contract_version`; do not infer v1 |
| Raw-row creation receives a versioned envelope | Reject rows shape; do not route to Reader implicitly |
| Dataset view is evaluated | Use shared path/projection/filter/sort/page implementation |
| Options projection produces missing, duplicate, null, boolean, object, or array values | `dataset_projection_invalid`; block Experience/Source |
| Runtime needs HTTP data | Use code-authored Data Source outside Studio Dataset |
| Resource transfer kind/version/base64/hash/length/budget is invalid | Reject the entire Reader result with stable diagnostics |
| Project transfer omits/duplicates/adds embedded content or attaches it to a URL | Reject the entire project before persistence |
| Resource URL uses a dangerous scheme, credentials, or traversal | Reject Resource metadata/transfer |
| Source resolver misses a component | `source_resolution_failed`; produce no partial file set |
| Source resolver returns a bare module or style import without its package version in `dependencies` | `source_resolution_failed`; produce no partial file set |
| Raw `package.json.dependencies` or application runtime bare-package import references ConfigForm, Zod, `@moluoxixi/*`, `@config-form/*`, or another non-whitelisted runtime package | Reject Raw generation/consumer architecture; allowed runtime packages are Vue, Vue Router, and the selected target UI package only; build-only devDependencies remain allowed |
| Raw generation fails while ConfigForm binding succeeds, or vice versa | Preserve the successful mode as `ready` and the failed mode's diagnostics as `failed`, both bound to the same compilation identity |
| Source generates an embedded Resource | Await exact hashed bytes, validate, derive a safe path, and emit one binary file |
| Source generates a URL Resource | Keep the validated URL; never call the resource reader or fetch it |
| Source resource read is missing/stale/corrupt | Emit resource diagnostic; resolve with no partial file set |
| SourceFileSet has duplicate/unsafe paths, unsorted files, or a missing/non-text entry | Reject the file set |
| Root/session import touches `window` or Vue DOM | Fail Node import and architecture test |
| Runtime config contains `props.onX` | Preserve ordinary direct listener behavior; never serialize it |

## 8. Good / Base / Bad Cases

- Good: one Page button semantically activates one `open` action for a Drawer,
  passes two parameters, receives `saved`, atomically maps its JSON result into
  caller fields, and then reevaluates value/state rules.
- Good: the same Dialog asset is opened from two rows; each instance has a
  different `item`-derived parameter and independent form values.
- Good: options, Table, and List consume the same Dataset query service with
  different projections while each Material owns its selection state.
- Good: one Select options command updates its string enum base, removes an
  invalid default, and one Undo restores all three values.
- Good: Studio injects an Element Plus resolver into the DOM-free Source
  generator; the generator has no import from the adapter or Workbench.
- Good: ConfigForm binding resolution fails while Raw generation succeeds from
  the same valid compilation; Workbench shows Binding diagnostics without
  disabling the Raw file tree. A shared invalid rule or unresolved custom
  validator fails each API's own preflight and yields no partial file set.
- Base: a single Page with static fields has no Dataset or interaction and
  behaves identically in Experience and generated source.
- Bad: store Dialog content as a nested node in every opener graph.
- Bad: key running form state by `surfaceId`, causing two Dialog instances to
  share values and validation.
- Bad: call value actions on initialization to “settle” defaults.
- Bad: represent a click as `{ event: 'click', actions: [...] }` or forward DOM
  arguments through an iframe.
- Bad: let each Table/List adapter implement its own filter/sort/page rules.
- Bad: let the versioned Dataset Reader accept a bare row array.
- Bad: expose date rules for a time Material, or repair Select validation from a
  watcher after the options command has already published.
- Bad: import Designer adapter metadata from Source to avoid resolver injection.
- Bad: pass a merged resolver to Raw, include ConfigForm/Zod in its manifest, or
  discard both export modes because only one mode failed.
- Bad: keep the old Workbench export entry as a re-export after Source moves.

## 9. Tests Required

### Model and version readers

- Accept complete ProjectDocument v8, Project transfer v1, SurfaceGraph v3,
  RuleSet v2, Dataset transfer v1, Resource transfer v1, Project theme v1,
  Prototype session v1, and SourceFileSet v1 happy paths.
- Reject lower, higher, missing, malformed, and mixed versions with stable code,
  expected/received context, and deterministic ordering.
- Cover valid empty Dataset collections; reject empty/no-Page Surface
  collections, order/map non-bijections, map key/id mismatches, invalid or
  duplicate Page routes, non-Page home, wrong action target kinds, dangling
  references, in-use deletion, duplicate parameter/output names, and in-place
  kind changes.
- Round-trip field/layout/element nodes with graph props, form, root/slot
  placement, field-level Required/Required message, RuleSet v2 validation,
  extensions, and value scopes. Reject RuleSet v1, `kind: 'required'`, element
  nodes masquerading as fields, removed graph fields, and Registry v3 node
  bindings that exceed declared Dataset/Resource/projection/media capabilities.
- Prove Registry-aware validation rejects RuleSet validation on a `time`
  Material, while Required/Required message and `validateOn` remain valid.
- Accept valid Dialog/Drawer title/mask/close/ResponsiveLength values and Theme
  v1 tokens; reject unreachable mask-close policy, arbitrary CSS, unknown keys,
  invalid units/ranges/colors, negative values, NaN, and Infinity.
- Prove raw Dataset rows create v1 only through the explicit command and the
  envelope Reader rejects those same rows.

### Repository, compiler, and transport

- Keep Surface, Dataset, and Resource revisions independent; cover concurrent
  commit, recovery, retention, checksum, and orphan cleanup.
- Compile each Surface once, preserve reference IDs through cycles, and key
  incremental caches by asset identity/revision rather than instance state.
- Reject old IR/compiler/storage/transfer/host/generator contracts atomically.
- Remap Surface, field, node, Dataset, Resource, and expression-AST references at
  project import; fail closed when a reference cannot be rewritten.
- Round-trip full project JSON with every embedded Resource byte-for-byte and URL
  Resource metadata-only. Reject duplicate/missing/extra embedded content,
  content attached to URL resources, invalid canonical base64, length/hash
  mismatch, unsafe filename/URL, and per-resource/project budget overflow before
  committing either metadata or bytes.
- Prove Project transfer writer order is deterministic, skips URL Resources,
  returns no partial envelope on missing/rejected/thrown/stale bytes, and writes
  `embeddedContents: []` for a no-Resource write -> JSON -> read round trip.

### Dataset and materials

- Cover nested path access, missing paths, stable multi-key sorting, filtering,
  pagination bounds, total-before-page, and input immutability.
- Run one shared query fixture through options, Table, List, Preview, and
  generated source. Adapter tests cover rendering/selection only.
- Prove runtime views cannot mutate Dataset rows and field values do not
  silently capture whole row objects.
- Prove options values are unique `string | number`; missing paths, duplicate
  values, and null/boolean/object/array values block Experience and Source with
  `dataset_projection_invalid`.
- Designer command tests change inline Select options with existing enum/literal
  validation and defaults. Assert exact base re-derivation or validation
  removal, invalid-default removal, one revision/history item, atomic rollback,
  and one-Undo restoration for both provider adapters.

### Interaction and session

- Initialization computes state/property projections but never runs value
  actions or primary UI actions.
- User and named-result changes run `set/copy/clear` exactly once per settled
  transaction; cycles and invalid expressions publish no partial state.
- Cover Safe Expression own-property access, forbidden prototype segments,
  missing/coalesce behavior, strict deep equality, boolean short-circuiting,
  same-type ordering, function arity/types, finite arithmetic, JSON-safe output,
  and the 32-depth/256-node limits without JavaScript coercion.
- Cover omitted `values` selector defaulting to `current`, explicit
  `current/parent/root` across nested value scopes, root-parent fallback, and
  Reader rejection of selectors on `parameters/result/item`; run the same
  fixtures through the reducer, Preview/Experience, and generated Source.
- Reject duplicate state-projection targets and prove dynamic projections
  override their static baseline. For multi-write value rules, assert the stable
  warning, declaration-order staging, and last-write-wins result.
- Reject arbitrary DOM triggers, multiple primary actions, action arrays, HTTP,
  delay/retry/parallel, functions, scripts, and Flow shapes.
- Cover navigate/back/open/closeCurrent/closeAll, optional validation, required
  parameters, named outputs, result rollback, repeated same-Surface instances,
  and A -> B -> A.
- Cover root/parent/current scoped field resolution, nested array row addresses,
  row/item-derived parameters, address-scoped projection, stale row rejection,
  and same-node different-row result/focus isolation.
- Prove `back` with overlays closes exactly the top instance without changing
  Page history; prove `back` with no overlay returns to the previous Page.
- After closeCurrent, closeAll, overlay dismissal, back, and navigation, prove
  `instancesById` equals the exact union of page-history and overlay IDs and no
  closed instance retains values, validation, focus, or parameter state.
- Exercise enabled/disabled ESC, mask, and close-button policy; every enabled
  dismissal closes only the top instance and restores focus to its live opener.
- Retain production Runtime listener ordering and direct `props.onX` tests.

### Preview, Source, and architecture

- Execute the same navigation, overlay, Dataset, validation, and interaction
  scenario in Studio Experience and an installed generated consumer. Comparing
  generated strings alone is insufficient.
- Node-import generator and Prototype root/session entries with no DOM globals;
  verify Vue/Monaco remain behind `/vue` or `/viewer` async boundaries.
- Build and typecheck real generated projects for Element Plus and Ant Design
  Vue; assert byte-stable files for the same compilation/resolver/resource
  snapshot and no partial file set from the failing generation API. Do not use
  workspace/internal soft links to satisfy generated dependencies.
- Scan every Raw `package.json.dependencies` map and application runtime
  bare-package import for the exact Vue, Vue Router, and target-UI whitelist;
  permit legitimate build tooling only in `devDependencies`. Execute field-level Required,
  Required message, RuleSet v2, and `validateOn` behavior through the generated
  local validation module, not a string-only assertion.
- Force Raw-only and Binding-only failure paths and assert Workbench publishes
  independent `ready | failed` artifacts for one compilation; commands are
  disabled only for the failed mode.
- Await a Repository-backed `SourceResourceReader`, verify it receives the exact
  project/resource/hash identity and returns a copied snapshot, and assert Source
  validates length/hash, derives safe deterministic paths, emits canonical
  binary base64, stable file ordering, and an existing text `entry`.
- Prove URL Resources never call the resource reader or network fetch, and that
  missing/stale/corrupt embedded bytes resolve generation with diagnostics and
  no partial file set.
- Verify Viewer controlled selection, desktop split, narrow tree/code switch,
  lazy Monaco, keyboard/focus behavior, and accessibility.
- Architecture tests reject outward dependencies, duplicate session/query
  implementations, Workbench wrappers/re-exports, compatibility readers, event
  domains, action chains, and Flow symbols.

## 10. Wrong vs Correct

Wrong:

```ts
interface NodeEvent {
  event: string
  actions: Action[]
}
```

Correct:

```ts
interface PrimaryUiActionBinding {
  nodeId: NodeId
  trigger: MaterialSemanticTrigger
  action: PrimaryUiAction
}
```

Wrong:

```ts
function readDataset(input: unknown) {
  if (Array.isArray(input))
    return { version: 1, rows: input }
}
```

Correct:

```ts
readDatasetTransfer(versionedEnvelope)
createDatasetFromRows({ id, name, rows })
```

Wrong:

```ts
import { elementPlusMetadata } from '@moluoxixi/config-form-designer-element-plus'
generateSource(compilation, elementPlusMetadata)
```

Correct:

```ts
const componentResolver = createStudioComponentResolver(project.registryLock, adapterMetadata)
const bindingResolver = createStudioBindingResolver(adapterMetadata)
const resourceReader = createStudioResourceReader(repository)
await generateVueSource({
  compilation,
  componentResolver,
  resourceReader,
})

await generateConfigFormBindings({
  compilation,
  componentResolver,
  bindingResolver,
  resourceReader,
})
```
