# ConfigForm Designer Contracts

## Scenario: Extending the visual ConfigForm designer across document, adapter, and Runtime packages

### 1. Scope / Trigger

Apply this contract when a change adds or modifies a designer document field that affects the canvas, compiler output, a UI adapter, or `ConfigFormRenderer`. The document remains the serializable source of truth; preview-only state and resolved adapter data must remain derived state. It also applies when a concrete UI adapter package is added or removed from the workspace and release surface.

### 2. Signatures

```ts
type ConfigFormBreakpoint = 'desktop' | 'tablet' | 'mobile'
type DesignerAdapter = 'element-plus' | 'antd-vue'

interface ConfigFormResponsiveLayoutOverride {
  columns?: number
  fieldSpan?: number
}

interface ConfigFormResponsiveLayout {
  tablet?: ConfigFormResponsiveLayoutOverride
  mobile?: ConfigFormResponsiveLayoutOverride
}

function resolveConfigFormLayout(
  columns: number | undefined,
  fieldSpan: number | undefined,
  responsive: ConfigFormResponsiveLayout | undefined,
  breakpoint: ConfigFormBreakpoint,
): { columns: number, fieldSpan: number }

type DesignerOptionSource
  = | { kind: 'static' }
    | { kind: 'dictionary', key: string }
    | { kind: 'provider', key: string, params?: DesignerJsonObject }
```

The root package gate must build every package whose `dist` is read by the verifier in the same command:

```json
{
  "test:config-form-packages": "pnpm -r --filter \"./packages/ConfigForm/plugin-*\" --filter \"@moluoxixi/config-form-designer-element-plus\" --filter \"@moluoxixi/config-form-designer-antd-vue\" build && node scripts/verify-config-form-adapter-packages.mjs"
}
```

### 3. Contracts

- Existing numeric `form.columns`, `form.fieldSpan`, and node `span` values remain parseable for backward compatibility. Authoring controls and new responsive overrides use the 1..24 coordinate system.
- Desktop is the numeric base. Tablet applies at `max-width: 1024px`; mobile applies at `max-width: 720px`. Mobile inherits omitted tablet values before applying its own overrides.
- Designer and Runtime call the same `resolveConfigFormLayout` helper. Node span is clamped to the resolved active column count.
- A missing node `span` means inheritance from the active resolved `fieldSpan`; property panels may display the resolved number with an `Inherited` marker, but blur without an edit must not materialize `span` into the document.
- `ConfigFormRenderer` emits CSS variables for all three breakpoints. Every adapter style entry that exposes the renderer must include `@moluoxixi/config-form/styles/responsive`; importing only an adapter style entry must still produce working media rules.
- Static options remain in `props.options`. Dictionary and provider metadata is serializable in `props.optionSource`. The adapter owns resolution, cancellation, normalization, loading, error, and empty states; the core designer never performs transport work.
- Element Plus and Ant Design Vue are sibling designer adapters. The core must not import either UI framework, and neither adapter may import the other. Both adapters expose equivalent material, readonly, default-value, option-source, diagnostics, layout, and locale capabilities while using their framework-native value/update contracts.
- Adapter sample documents use namespaced material keys (`element.*` and `antd.*`). Visual framework switching selects the corresponding registry and independent document state; it does not rewrite arbitrary documents between namespaces.
- Supported canvas fields render real components from the active UI library. Browser verification must prove that Ant Design Vue mode contains Ant components and no Element Plus field controls, and vice versa.
- Linkage preview builds a cloned mock model from document defaults. Preview field edits update only that model and must not mutate the persisted document or exported JSON.
- Editing any `visible`, `hidden`, `disabled`, `readonly`, or `required` condition enables linkage preview so the condition is observable immediately; this mode change is UI state and is excluded from the document export.
- Default/rule diagnostics are derived projections. Invalid option membership, value kinds, nullable/required conflicts, and adapter resolution failures block export without rewriting the document.
- Native date inputs emit `YYYY-MM-DD` and native number inputs emit strings. Setters must normalize dates to ISO datetime strings and numbers to finite numeric primitives before committing; empty or invalid edits restore the previous value without emitting.
- Cross-field compare validators require both values to have the same normalized kind. Date-base rules may normalize valid ISO strings and `Date` instances to timestamps; mixed number/string comparisons fail rather than relying on JavaScript coercion.
- A public package verifier may inspect only artifacts that its preceding command built. Never rely on stale local `dist` output; every verifier entry must have a matching build filter so a clean checkout and an already-built workspace behave identically.
- Removing an adapter means removing its workspace packages, package importers, aggregate exports, Playground code, tests, verifier entries, supported documentation, and release package entries. Keep one explicit breaking-change note for consumers.

### 4. Validation & Error Matrix

| Input/state | Required behavior | Error/diagnostic |
| --- | --- | --- |
| No responsive config | Preserve numeric desktop behavior at every breakpoint | None |
| Responsive value outside 1..24 | Reject the document update/import | Zod parse issue |
| Node span exceeds active columns | Render with active column count | None; clamp only |
| Unknown dictionary/provider key | Keep source metadata and expose resolver failure | Actionable adapter diagnostic |
| Provider request superseded | Abort or ignore stale completion | No stale state write |
| Resolved options empty | Render an explicit empty state | `No options` status |
| Default not in resolved options | Preserve default in document and block export | Node-scoped diagnostic |
| Linkage preview edit | Re-evaluate conditions immediately | No document mutation |
| Inherited node span shown in setter | Show active field span and `Inherited` marker | Blur without change must not add `node.span` |
| Native date/number input is empty or invalid | Keep last valid serialized value | No `0`, empty date, or numeric string is emitted |
| Compare values have different normalized kinds | Reject comparison | No JavaScript implicit coercion |
| Verifier lists a package whose build filter omits it | Fail in a clean checkout because `dist/index.js` or declarations are absent | Fix the build filter; do not weaken artifact assertions |
| Active adapter document contains another adapter's material key | Report an unknown material instead of silently substituting a component | Node-scoped registry diagnostic |
| Removed adapter remains in a package importer or supported entry point | Fail removal audit | Delete the supported reference; retain only historical records and the breaking note |

### 5. Good / Base / Bad Cases

```ts
// Base: old numeric documents remain valid.
const form = { columns: 24, fieldSpan: 24 }

// Good: two-up desktop, single-column mobile.
const responsive = {
  tablet: { columns: 12, fieldSpan: 12 },
  mobile: { columns: 1, fieldSpan: 1 },
}
const nodes = [{ span: 12 }, { span: 12 }]

// Good: adapter registries remain independent.
const registries = {
  'element-plus': createElementPlusDesignerRegistry(),
  'antd-vue': createAntdVueDesignerRegistry(),
}

// Bad: transport logic or concrete UI imports inside the core designer.
await fetch(document.nodes[0].props.optionSource.url)
import { Input } from 'ant-design-vue'
```

### 6. Tests Required

- Schema round-trip: old numeric documents, optional responsive config, invalid responsive bounds, export/import, and undo/redo.
- Shared resolver unit tests: desktop/tablet/mobile inheritance and span clamping.
- Compiler tests: responsive and option-source metadata survive without reference sharing.
- Adapter tests: material parity, native value/checked bindings, readonly renderers, static/dictionary/provider normalization, request params, cancellation, mixed primitive option keys, loading/error/empty UI, and locale completeness.
- Preview tests: visible/hidden/disabled/readonly/required conditions update from the mock model while exported JSON remains byte-equivalent.
- Setter tests: inherited span display/blur, ISO date conversion, invalid numeric recovery, and literal number preservation.
- Validator tests: date `Date`/ISO comparisons and mismatched equality/ordering types fail consistently.
- Browser tests: 24/12/1 computed grid columns, standalone narrow layout, real components for each adapter, independent framework documents, flex/grid containers, readonly/default labels, operation-bar drag, and diagnostic export blocking.
- Package tests: run adapter unit/type/build checks, build every verifier target in the same root command, then compile public runtime and type exports from built declarations and scan adapter CSS output for responsive selectors.
- Removal audit: search tracked supported code, package manifests, lockfile importers, scripts, tests, and documentation for the removed adapter; allow only intentional breaking-change or historical task records.

### 7. Wrong vs Correct

#### Wrong

```ts
// Designer and Runtime implement separate breakpoint math.
const columns = window.innerWidth <= 1100 ? 12 : 24

// Provider resolution overwrites the saved document with fetched options.
node.props.options = await provider(node.props.optionSource)
```

```json
{
  "test:config-form-packages": "pnpm --filter designer-element-plus build && node verify-all-adapters.mjs"
}
```

The verifier reads Ant Design Vue artifacts that the command did not build, so the result depends on stale local output.

#### Correct

```ts
const layout = resolveConfigFormLayout(columns, fieldSpan, responsive, breakpoint)
const optionState = await adapterResolver.resolve(optionSource)

// Both values are derived; the serialized document is unchanged.
void [layout, optionState]
```

```json
{
  "test:config-form-packages": "pnpm --filter designer-element-plus --filter designer-antd-vue build && node verify-all-adapters.mjs"
}
```

The correct form keeps framework adapters independent and makes package verification deterministic from a clean checkout.
