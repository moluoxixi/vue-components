# Technology Selection Evidence

## Chosen MVP tools

- Direct `sortablejs@1.15.7`: already in the workspace catalog/lockfile and used in production by `ColumnSettings.vue`; it supports grouped lists, clone sources, handles, empty targets and move vetoes. Keyboard movement remains an application command path.
- Existing Zod 3: the current renderer accepts `ZodTypeAny` and executes `safeParseAsync`; a new rules package should compile JSON-safe descriptors to this existing contract.
- Pure reducer plus bounded snapshots: no Pinia, Immer, XState or VueUse history is needed for the first synchronous, single-instance controlled document editor.
- Vitest and Playwright: existing package and ConfigForm playground verification tools.

## Rejected direct engines

- Formily Designable and Alibaba Lowcode Engine: useful material/setter/plugin concepts, but their designer ecosystem and runtime contracts are not a drop-in Vue ConfigForm match.
- amis editor: React page-level editor/runtime; adopting it would replace the current renderer contract.
- form-create/designer: closest Vue/Element Plus UX reference, but its rule JSON and runtime would still require a full translation layer.
- VForm/Variant Form: older dependency baseline and restrictive/non-standard licensing signal; do not use as a runtime dependency.

## Future upgrade triggers

- Evaluate `@vue-dnd-kit/core` only when first-class keyboard drag gestures, collision strategies or overlays are product requirements.
- Evaluate VueUse history only when automatic/coalesced capture or persistence is required and command boundaries remain explicit.
- Evaluate Immer patches only after profiling shows snapshot/path-copy updates are a document-size bottleneck.

## External references

- SortableJS: https://github.com/SortableJS/Sortable
- Vue DnD Kit: https://github.com/zizigy/vue-dnd-kit
- Formily: https://github.com/alibaba/formily
- Lowcode Engine: https://github.com/alibaba/lowcode-engine
- form-create designer: https://github.com/xaboy/form-create-designer/tree/next
