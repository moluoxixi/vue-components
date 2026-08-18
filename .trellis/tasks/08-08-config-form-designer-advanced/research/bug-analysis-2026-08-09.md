# Bug Analysis: Designer Resolution and Validation Boundaries

## 1. Root Cause Category

- **Category B: Cross-layer contract** - the document, designer projection, compiler, adapter preview, and Runtime did not share an explicit distinction between raw values and resolved values.
- **Category D: Test coverage gap** - unit tests covered individual condition and rule functions, but the browser path was the first place where an always-disabled condition and real Element Plus control had to be observed together.
- **Category E: Implicit assumption** - native date and number inputs expose strings, while the serializable rule contract requires ISO timestamps and numeric primitives.

Specific cases:

- A missing node `span` is intentionally inherited from the active `fieldSpan`, but the property panel originally rendered the raw `undefined` value. The fix keeps the document raw value absent while rendering a resolved value with an explicit `Inherited` marker.
- Editing a condition writes a document-level condition, but the preview model is a separate derived state. The designer now enters linkage preview after a condition edit so the saved condition is visible immediately without persisting mock input.
- Date rule controls map calendar input to ISO midnight timestamps; numeric and literal-number controls validate finite values before committing.
- Rule compare validators now enforce the same value kind for every operator and normalize ISO strings only for date-base rule sets.

## 2. Why Earlier Fixes Failed

1. Treating an inherited span as a normal number setter made a visual fallback become persisted document state on blur.
2. Fixing only the condition compiler or only the canvas left the runtime/preview entry mode unchanged, so users still saw no state change until manually enabling linkage preview.
3. Reading native input values as if they already matched the rule contract silently produced invalid dates, `0` on empty numeric input, or string values for numeric literals.

## 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
| --- | --- | --- | --- |
| P0 | Shared contract | Keep raw document values separate from resolved layout and preview projections; use the shared responsive resolver in Designer and Runtime. | DONE |
| P0 | Boundary normalization | Convert browser calendar/number values at the setter boundary and reject empty/invalid values without emitting. | DONE |
| P0 | Regression tests | Cover inherited span blur, condition preview, real Element Plus disabled state, rule round-trip, ISO date compare, and numeric literal edits. | DONE |
| P1 | Browser matrix | Keep desktop plus 900px stacked and 390px narrow viewport checks in the standalone designer E2E. | DONE |
| P1 | Review checklist | For any new serializable editor control, require a document-parse/export test and one real-adapter/browser assertion. | TODO: promote through `update-spec` review |

## 4. Systematic Expansion

- Similar risks exist anywhere a setter displays a default or inherited value, especially responsive overrides, option-source defaults, and condition mock values.
- Any new rule base type or cross-field validator must define its normalized runtime value and test both direct schema validation and the headless validator boundary.
- The preview model is intentionally ephemeral; future preview-only fields must remain out of the document type and export signature.

## 5. Knowledge Capture

- Candidate for the frontend cross-layer thinking guide: raw-versus-resolved state must be explicit at document/UI/runtime boundaries.
- Candidate for frontend quality guidelines: native input values require type/date normalization before emitting serializable configuration.
- Candidate for task-specific designer contract: condition edits should enable linkage preview while preserving document byte-equivalence.
