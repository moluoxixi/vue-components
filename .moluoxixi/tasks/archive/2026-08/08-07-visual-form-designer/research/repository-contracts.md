# Repository Contract Evidence

## ConfigForm runtime

- `packages/ConfigForm/headless/src/types/props.ts:172-239` defines the recursive `ConfigFormNode` union: field nodes bind `field`, while component nodes contain `slots` and do not bind form values.
- `packages/ConfigForm/runtime/src/renderer/types.ts:44-86` exposes `fields`, controlled model rendering and renderer events/expose methods.
- `packages/ConfigForm/runtime/src/renderer/ConfigFormRenderer.vue:146-181, 281-316, 518-528` owns recursive layout/rendering, field binding and cycle detection.
- `packages/ConfigForm/headless/src/types/props.ts:5, 153, 200-219` permits functions, Vue component objects and `ZodTypeAny`; these values are not JSON-safe.
- `packages/ConfigForm/runtime/src/runtime/types.ts:13-68` provides a component/plugin registry, but no designer metadata or setter contract.

## Existing extension and verification patterns

- `packages/ConfigForm/plugin-element-plus/package.json:31-46` and `vite.config.ts:38-47` show the peer dependency and externalization pattern for Element Plus adapters.
- `packages/components/src/ConfigTable/src/components/ColumnSettings.vue:108-143, 203-246` uses direct SortableJS, immutable array replacement and explicit keyboard move controls.
- `packages/ConfigForm/playground/playwright.config.ts:1-43` and `e2e/config-form-playground.spec.ts:473-582` provide the existing browser verification host and recursive/200-field regression patterns.
- `packages/ConfigForm/runtime/package.json:60-78` and `pnpm-workspace.yaml:35-64` establish Zod 3 as the current peer/catalog contract; do not upgrade to Zod 4 as part of this feature.

## Architectural implications

The designer needs a separate JSON-safe document with stable node IDs, a registry containing material metadata/setters, and one compiler that projects into the existing renderer nodes. Runtime behavior must remain unchanged and must not parse a second designer payload.
