# ConfigForm Material Registry Contract

## 1. Scope / Trigger

Use this contract when adding or changing built-in ConfigForm runtime components or designer materials. Core owns deterministic named-module validation; Headless and Designer own typed projections; UI adapters own build-time file discovery.

The dependency direction is:

```text
config-form-core -> config-form-headless / config-form-designer -> UI adapters
```

Core and Headless must not use `import.meta.glob`, filesystem APIs, Vue UI libraries, or adapter imports.

## 2. Signatures

```ts
createConfigFormModuleRegistry<T>(modules: ConfigFormNamedModuleMap<T>): ConfigFormNamedModuleRegistry<T>
defineConfigFormModule<T>(module: ConfigFormNamedModule<T>): ConfigFormNamedModule<T>

createConfigFormComponentRegistry<TComponent>(
  modules: ConfigFormComponentMaterialMap<TComponent>,
): ConfigFormComponentRegistry<TComponent>

createDesignerMaterialModuleRegistry(
  modules: DesignerMaterialModuleMap,
): DesignerMaterialModuleRegistry

createDesignerRegistry({
  materials?,
  layers?,
  rendererNamespace?,
}): DesignerRegistry

defineDesignerFieldMaterial({
  key,
  title,
  category,
  component,
  value?,
  props?,
}): DesignerFieldMaterialDefinition

type DesignerPropertyControlKey = DesignerSimpleSetterControl | 'defaultValue'

interface DesignerDefaultValueControlProps {
  modelValue?: DesignerJsonValue
  kind: DesignerDefaultValueKind
  options?: DesignerSetterOption[]
  disabled?: boolean
}

interface DesignerMaterialDefinitionBase {
  events?: Array<{ name: string, title: string }>
  runtime: { valueProp?: string, trigger?: string }
}
```

Adapter discovery is eager and local to one aggregation entry:

```ts
const modules = import.meta.glob<DesignerMaterialModule>(
  './materials/*.ts',
  { eager: true, import: 'default' },
)
```

## 3. Contracts

- Each built-in material lives in `src/materials/<name>.ts`.
- The basename contains one dot only: the extension separator. Files such as `text.backup.ts` are invalid.
- `module.name` must equal `<name>` and match `/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/`.
- `__proto__`, `constructor`, and `prototype` are forbidden.
- Designer material keys remain adapter-namespaced, and their final segment must equal `module.name`.
- Entries sort by non-negative integer `order`, then `name`, then source. Never rely on filesystem traversal order.
- A designer module co-locates `material`, optional locale, and order. The registry derives both the material array and locale map from the same entries.
- `material.events` declares non-binding component events that may trigger a Flow. Field value-binding events are derived from `runtime.valueProp/trigger`; explicit events merge by canonical name and may replace the generated display title without creating a duplicate event.
- Event names are stable Registry contract values, not DOM event discovery results. They must be non-empty, trimmed, whitespace-free, unique within the material, and must not use `__proto__`, `constructor`, or `prototype`.
- Scanning creates adapter defaults only. Runtime caller `components` and Designer caller layers retain their existing higher precedence.
- Public adapter registry constants must be explicitly annotated with Headless/Designer layer types. Do not leak an inferred Core type through an adapter declaration.
- Ordinary field materials use `defineDesignerFieldMaterial()` when their node is one field with declarative defaults. The helper derives `kind`, version, Runtime binding, prop/default-value setters, and a JSON-safe node factory; it does not reflect arbitrary Vue props.
- Field property descriptors support only the simple control vocabulary owned by `DesignerPropertyControlRegistry`. Provider-specific or compound setters stay explicit through the helper's additional `setters` option.
- `DesignerPropertyControlRegistry.defaultValue` is an optional adapter slot for the compound default-value setter. When present, Designer passes `modelValue`, `kind`, `options`, and `disabled`, merges registered control props, and consumes `update:modelValue`; when absent, the UI-library-neutral core `DesignerDefaultValueSetter` remains the fallback.
- Provider-specific default-value controls use that provider's maintained input, number, switch, select, date, and time primitives. Designer core must not import a UI library, and native-control selectors must target only core-owned DOM instead of descendants inside an adapter component.
- Every generated node receives a deep clone of default props/defaultValue. The helper never owns global field-name uniqueness; the Designer controller continues to supply the unique field in `DesignerCreateNodeContext`.
- Provider Designer registries accept one options object with `materials`, advanced `layers`, and provider option resolution. Consumer materials are wrapped in an internal highest-precedence layer so normal callers never invent a layer name.
- `DesignerMaterialDefinition.createNode` and `DesignerRegistryLayer` remain public low-level contracts for layout materials, subgraphs, custom component registries, validators, and advanced precedence composition.
- Core `createDesignerRegistry()` directly owns consumer material precedence. Its order is direct `materials`, then advanced `layers` in declaration order; Provider adapters append their default layer last and must not duplicate anonymous consumer-layer assembly.
- Provider material leaf files stay atomic, but cross-material utilities are separated by responsibility. A `shared.ts` file must not combine icons, Vue components, source binding, setters, defaults, and binding constants.
- Registry/module/source/setter construction is pure service or utility code. Use a composable only when the implementation actually owns Vue reactive state, injection, or lifecycle.

## 4. Validation & Error Matrix

| Condition | Required result / error code |
|---|---|
| Missing module name | `CONFIG_FORM_MODULE_NAME_REQUIRED` |
| Unsafe or malformed module name | `CONFIG_FORM_MODULE_NAME_INVALID` |
| Filename contains extra dots or is malformed | `CONFIG_FORM_MODULE_SOURCE_INVALID` |
| Filename and declaration name differ | `CONFIG_FORM_MODULE_NAME_MISMATCH` |
| Duplicate declaration name | `CONFIG_FORM_MODULE_NAME_DUPLICATE` |
| Negative or non-integer order | `CONFIG_FORM_MODULE_ORDER_INVALID` |
| Designer module has no valid material | `DESIGNER_MATERIAL_MODULE_INVALID` |
| Designer key final segment differs from module name | `DESIGNER_MATERIAL_MODULE_KEY_MISMATCH` |
| Designer event is empty, unsafe, malformed, or duplicated | `DESIGNER_MATERIAL_EVENT_INVALID` |
| Adapter omits `propertyControls.defaultValue` | Render the core default-value control without changing the registry contract |
| Adapter registers `propertyControls.defaultValue` | Render the adapter control and preserve registered props plus value/disabled/options wiring |

Errors must retain source/name context. Do not let malformed runtime input fall through to native `TypeError`.

## 5. Good / Base / Bad Cases

Good:

```ts
export default defineDesignerMaterialModule({
  name: 'input-number',
  order: 30,
  value: {
    material: {
      key: 'element.input-number',
      events: [{ name: 'change', title: 'Committed value' }],
      /* ... */
    },
    locale: { title: '数字输入' },
  },
})
```

Base: a direct Headless component material may omit `order`; unordered entries sort after ordered entries by name.

Base: a Designer adapter may omit `defaultValue`; the core fallback remains valid for UI-library-neutral consumers.

Bad:

```ts
// File: materials/text.backup.ts
export default defineConfigFormComponentMaterial({
  name: 'text',
  value: { component: Input },
})
```

## 6. Tests Required

- Core unit tests assert stable ordering and every error code above.
- Headless tests prove direct components and binding-aware registration objects preserve `ConfigFormComponentRegistry` shape.
- Designer tests prove material/locale co-location and malformed-value diagnostics.
- Designer tests prove explicit events merge with generated field binding events by canonical name and reject malformed/duplicate declarations.
- Designer tests prove the high-level field helper derives setters and Runtime binding, respects binding overrides, produces valid nodes, and deep-clones every default.
- Designer tests prove a registered `defaultValue` control receives registry props and commits through `update:modelValue`, while an unregistered adapter still renders the core fallback.
- Provider adapter tests mount every supported default-value kind through real library components and verify value, clear, disabled, option, date, and time wiring. Browser coverage must prove the provider input keeps one library-owned focus frame.
- Each adapter test asserts exact material names, source paths, order, locale coverage, provider-specific binding triggers, explicit events, and existing caller override precedence.
- Each Designer adapter test registers a caller material without a named layer and proves it overrides provider defaults; advanced layers remain independently testable through the options object.
- `pnpm test:config-form-packages` must explicitly build Core and validate Core, Headless, Designer, and adapter JS exports plus independent TypeScript consumers.

## 7. Wrong vs Correct

Wrong: hard-code a provider input in Designer core, or style every descendant `input` below the generic setter root.

Correct: register the provider default-value component through `propertyControls.defaultValue`, retain the core fallback, and scope native selectors to core-owned elements.

Wrong: maintain a hand-written array beside scanned files, discover Flow events from rendered DOM listeners, silently overwrite duplicate names, or let glob order define palette order.

Correct: use one named module per material, declare event capabilities in that material, derive binding events from the same Runtime binding, and keep application extension APIs separate from build-time scanning.
