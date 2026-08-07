# ConfigForm Designer Contracts

## Scenario: JSON-Safe Visual Form Authoring

### 1. Scope / Trigger

Apply this contract when adding or changing ConfigForm designer documents, material adapters, validation rules, command handling, or runtime preview compilation.

The host owns persistence and publication. The designer owns authoring validation, semantic analysis, editing history, compilation, and preview. Existing handwritten `ConfigFormNode[]` inputs remain independent and supported.

### 2. Signatures

```ts
interface DesignerDocument {
  version: 1
  form: DesignerFormSettings
  nodes: DesignerNode[]
}

function parseDesignerDocument(input: unknown): DesignerParseResult
function analyzeDesignerDocument(
  document: DesignerDocument,
  registry: DesignerRegistry,
): DesignerDiagnostic[]
function compileDesignerDocument(
  input: unknown,
  registry: DesignerRegistry,
): DesignerCompileResult
function reduceDesignerCommand(
  document: DesignerDocument,
  command: DesignerCommand,
  registry: DesignerRegistry,
): DesignerReduceResult
```
Validation rules use the standalone `@moluoxixi/zod3-to-rule` boundary:

```ts
function parseRuleSet(input: unknown): RuleParseResult
function rulesToZod(ruleSet: RuleSet, options?: RuleCompileOptions): RuleCompileResult
function zodToRules(schema: z.ZodTypeAny): RuleExportResult
```

### 3. Contracts

- A designer document contains JSON values only. Vue components, functions, `Date`, Zod instances, VNodes, and scripts never enter the document.
- Every node has an immutable designer `id`. Field nodes also have a unique business `field`; the two identities are not interchangeable.
- `material` is a stable registry key. Runtime Vue components and bindings are resolved only by `compileDesignerDocument`.
- Containers may contain only registry-declared slots. Slot `accepts`, `materials`, `min`, and `max` constraints apply even when a document omits a declared slot key.
- Conditions use the whitelisted condition AST. Every field operand must reference a field that exists anywhere in the complete document.
- Validation compare rules must reference an existing document field. `@moluoxixi/zod3-to-rule` validates rule shape; the designer owns document-level reference validation because only it has field context.
- All edits pass through `reduceDesignerCommand`. The reducer clones the current document, validates the candidate, and returns a new document only for a successful semantic change.
- SortableJS provides transient pointer feedback. Palette Sortable roots contain draggable items as direct children; document order and containment always come from reducer commands.
- Preview consumes the compiler's real `ConfigFormRenderer` nodes. Do not implement a second renderer for designer documents.

### 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Unknown document or rule version | Error diagnostic at `version`; no compilation |
| Non-JSON document value | Error diagnostic at the offending path |
| Duplicate node ID or field | Error diagnostic; command/import rejected |
| Unknown material or slot | `DESIGNER_MATERIAL_UNKNOWN` or `DESIGNER_SLOT_UNKNOWN` |
| Omitted/undersized required slot | `DESIGNER_SLOT_MIN_UNMET` |
| Slot exceeds maximum | `DESIGNER_SLOT_MAX_EXCEEDED` |
| Unknown condition field operand | `DESIGNER_CONDITION_FIELD_UNKNOWN` |
| Unknown validation compare field | `DESIGNER_RULE_FIELD_UNKNOWN` |
| Unsupported Zod refine/transform/preprocess | Structured lossy/unsupported export diagnostic |
| Illegal move, cycle, or immutable update | Command diagnostic and the original document |
| Any error-severity compiler diagnostic | No partially rendered designer output |

### 5. Good/Base/Bad Cases

- Good: import a versioned JSON document, validate all field references after collecting the complete tree, compile material keys through the registry, and render the compiler result with ConfigForm.
- Base: an empty version-1 document with `nodes: []` is valid and renders an empty canvas/preview.
- Bad: accept a condition that references a deleted field and let runtime comparison against `undefined` decide behavior.
- Bad: check `slot.min` only while iterating keys present in `node.slots`; an omitted required slot must fail too.
- Bad: serialize a Vue component or Zod schema into the authoring document.

### 6. Tests Required

- Parser tests assert JSON round-trip, version rejection, duplicate IDs/fields, invalid references, and exact diagnostic paths.
- Registry/analyzer tests assert unknown slots, child kind/material restrictions, omitted required slots, and min/max cardinality.
- Compiler tests assert material resolution, condition truth tables, rule compilation, and all-or-nothing behavior on error diagnostics.
- Reducer/history tests assert input immutability, add/move/copy/remove/update, cycle rejection, bounded history, and one semantic edit per history entry.
- Component tests assert palette Sortable roots have direct draggable children, mixed commit semantics, focus restoration, and keyboard movement.
- Browser tests use real pointer movement for palette and cross-container dragging, then assert undo/redo, export/import, and equivalent real runtime preview.
- Package gates include test, typecheck, and build for the rules package, designer core, and UI adapter.

### 7. Wrong vs Correct

#### Wrong

```ts
// The rules package cannot know whether this field exists in a form document.
const schema = rulesToZod(ruleSet)
return schema
```

```ts
// Missing registry slots are invisible to this loop.
for (const [name, children] of Object.entries(node.slots)) {
  validateCardinality(registrySlots.get(name), children)
}
```

#### Correct

```ts
const parsed = parseDesignerDocument(input)
if (!parsed.success)
  return parsed

const diagnostics = analyzeDesignerDocument(parsed.data, registry)
if (diagnostics.some(item => item.severity === 'error'))
  return { success: false, diagnostics }

return compileValidatedDocument(parsed.data, registry)
```

```ts
for (const slot of material.slots) {
  const children = node.slots[slot.name] ?? []
  validateCardinality(slot, children)
}
```
