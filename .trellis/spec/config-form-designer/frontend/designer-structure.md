# ConfigForm Designer Structure Supplement

Designer and Workbench follow the repository-wide
[directory structure contract](../../directory-structure.md). This document
contains only their additional domain constraints.

For Designer/Workbench specifically:

```text
feature/
  index.ts
  index.vue
  components/
  types/
  composables/
  state/
  services/
  schemas/
  adapters/
  utils/
  constants/
  defaults/
  __tests__/
```

Create only directories used by the feature. Import/Export/Template/Persistence
features must separate `types/`, `schemas/` or `validation/`, orchestration
`services/`, state, and UI components instead of keeping unrelated files flat
under `project/` or one large Vue component. Each present directory exposes one
local `index.ts`; feature and package barrels export only current contracts.
`types/` remains type-only: runtime defaults and expose proxies go to their
behavioral directories.

Do not create `compatibility/`, `migrations/`, deprecated forwarding folders,
or root-level `props.ts`/`expose.ts`. Current Registry checks belong in
`validation/` or `requirements/` and reject non-current contracts.
