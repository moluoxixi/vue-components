# ConfigForm Architecture Documentation

## Convention: Keep the architecture README current

`packages/ConfigForm/README.md` is the current-state architecture source of truth for the ConfigForm package family.

Update it in the same change set when a task changes any of these contracts:

- package ownership, package names, public subpaths, dependencies, or peer dependencies;
- the Headless/Renderer path or the Runtime/Plugin path;
- ProjectDocument, PageGraph, Headless node, reaction, slot, option source, or extension metadata;
- material/component registries, naming rules, error codes, discovery, or precedence;
- a capability reused by two or more ConfigForm packages.

Task `design.md` records implementation history and trade-offs. Package README files document package APIs. Neither is a substitute for updating the current architecture facts in `packages/ConfigForm/README.md`.

Before finishing a cross-package ConfigForm task, verify:

1. The dependency diagram still matches package manifests.
2. Package responsibilities and data flows match the implementation.
3. Extension selection and override precedence remain accurate.
4. New terminology distinguishes Runtime plugins, Designer adapters, lightweight UI packages, and Vue plugins.
5. `pnpm test:config-form-packages` covers any new public package boundary.

## Scenario: Headless Nested Slot Attr Inference

### 1. Scope / Trigger

Apply this contract when changing Headless `defineField`/`defineFields`, node attrs generics, or runtime slot node types.

### 2. Signatures

```ts
interface DefineConfigFormFieldFactory<TValues extends ConfigFormValues> {
  <
    TComponent = unknown,
    TFieldAttrs extends object = ConfigFormAttrs,
    TCellAttrs extends object = ConfigFormAttrs,
  >(field: ConfigFormFieldInput<TValues, TComponent, TFieldAttrs, TCellAttrs>): ConfigFormFieldInput<
    TValues,
    TComponent,
    TFieldAttrs,
    TCellAttrs
  >
}
```

### 3. Contracts

- Omitted `fieldAttrs` and `cellAttrs` keep the `ConfigFormAttrs` defaults; generic inference must not narrow either type to `undefined`.
- A component slot may contain heterogeneous component and field nodes created by the same bound `defineFields<TValues>()` factory.
- Explicit custom attrs remain inferred when provided and may use a named interface without an index signature; they must still be object-shaped.
- Runtime behavior remains identity-like: the helper marks components and recursively copies slots but does not add attrs or hidden metadata.
- Workbench Monaco declarations mirror the public constraints in the same change.

### 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Slot array mixes a component node and a field node without attrs | Compile with `ConfigFormAttrs` defaults |
| Caller supplies named custom field/cell attrs interfaces | Preserve their exact property types |
| Caller attempts a primitive attrs type | Fail the generic constraint |
| Runtime receives nested slot nodes | Preserve node order and collect only bound fields |

### 5. Good / Base / Bad Cases

- Good: one `defineFields<AccountForm>()` factory creates a container whose default slot contains a description component and a typed name field.
- Base: a single field without attrs uses `ConfigFormAttrs` for both attrs parameters.
- Bad: unconstrained attrs generics infer `undefined` from omitted optional properties and make sibling slot nodes mutually incompatible.

### 6. Tests Required

- Headless unit/type tests compile and collect a heterogeneous slot array containing both component and field nodes.
- Element and Ant adapter typechecks consume the public built declarations without casts.
- Workbench declaration tests verify the embedded Monaco surface stays synchronized.
- Root `pnpm typecheck` runs after rebuilding dependency declarations.

### 7. Wrong vs Correct

Wrong:

```ts
<TFieldAttrs = ConfigFormAttrs, TCellAttrs = ConfigFormAttrs>(field: Field<...>) => Field<...>
```

Correct:

```ts
<
  TFieldAttrs extends object = ConfigFormAttrs,
  TCellAttrs extends object = ConfigFormAttrs,
>(field: Field<...>) => Field<...>
```

## Current-Contract-Only Development Policy

### 1. Scope / Trigger

This policy applies to every package under `packages/ConfigForm/` while the
product remains pre-release. It is triggered whenever a schema, protocol,
public type, persisted record, generated artifact, component contract, or
cross-package API changes.

This section supersedes package-local text that permits a legacy reader,
migration chain, deprecated alias, shape fallback, or compatibility shim.
Archived Trellis tasks remain historical evidence and are not current
contracts.

### 2. Signatures

Current version identities are explicit at every ingest boundary and use one
field name: `version`. `revision` is reserved for content/history cursors;
`adapterVersion` and `contractVersion` are dependency/component identities.

```ts
PROJECT_DOCUMENT_VERSION = 4
PAGE_GRAPH_VERSION = 2
REGISTRY_CONTRACT_SNAPSHOT_VERSION = 1
CONFIG_FORM_FLOW_VERSION = 1
RUNTIME_HOST_PROTOCOL_VERSION = 3
```

The serialized field is always `version`:

```ts
ProjectDocument.version = PROJECT_DOCUMENT_VERSION
PageGraph.version = PAGE_GRAPH_VERSION
RegistryContractSnapshot.version = REGISTRY_CONTRACT_SNAPSHOT_VERSION
PageTransferDocument.version = 1
ProjectTemplateManifest.version = 1
```

`schemaVersion`, `protocolVersion`, and `storageSchemaVersion` are not valid
alternate spellings. `revision` is a content/history cursor, while
`adapterVersion` and `contractVersion` identify dependencies/components.

A boundary parser returns the current typed value or a diagnostic. It never
returns a migrated value:

```ts
type CurrentContractResult<T, D> =
  | { success: true, value: T }
  | { success: false, diagnostics: D[] }
```

### 3. Contracts

- Writers emit only the current contract. Readers accept only that exact
  contract. A lower, higher, missing, malformed, or ambiguous version fails
  closed before business logic, Runtime, Repository, or rendering.
- Do not add or retain legacy schema parsers, migration registries, migration
  callbacks, deprecated exports, alias props/events, renamed-field fallbacks,
  dual-shape unions, or silent normalization of an obsolete contract.
- A contract change is a hard cut across its writer, reader, public types,
  tests, fixtures, examples, generated source, documentation, and package
  exports in the same change set. Existing development data may be discarded;
  do not preserve it by adding an upgrade path.
- The ConfigForm public surface is owned only by the dedicated packages under
  `packages/ConfigForm/`. General-purpose aggregators such as
  `@moluoxixi/components` must not depend on, wrap, re-export, auto-import, or
  publish subpaths for ConfigForm. Add current functionality to its owning
  ConfigForm package instead of creating a second public route.
- Persistent development storage follows the same rule. On a storage contract
  change, use the new current schema or namespace and reject/delete stale
  development records explicitly. Do not migrate an older manifest, entity,
  draft, or cached payload.
- Public migration APIs and dormant extension points are still compatibility
  surface even when the production adapters register no migrations. Remove
  them rather than leaving an unused future path.
- A current protocol whose only version is `1` is not legacy. Keep it when its
  reader accepts exactly that current version and has no fallback or migration.
- Template manifests follow the same rule: the current manifest uses
  `version: 1` for format identity. The old content-revision meaning is gone;
  preview/cache identity derives from a canonical seed-content fingerprint.
  `schemaVersion`, `protocolVersion`, and `storageSchemaVersion` are not
  compatibility aliases and must be rejected.
- Cross-layer adaptation between two current contracts is allowed. For example,
  projecting current PageGraph placement into the current Runtime `span` field
  is not backward compatibility.
- Historical changelogs and archived task artifacts may describe removed
  contracts. Current README/spec documents and executable examples must not.

### 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Input version equals the current literal and the current schema passes | Accept without migration or repair |
| Input version is lower or higher than current | Return the boundary's stable unsupported-version diagnostic |
| Version is missing or shape is ambiguous | Return unsupported-format/schema diagnostics; do not guess |
| Registry identity differs in version, fingerprint, key set, or component contract | Reject; do not rebuild the source lock and continue |
| Persisted development record uses an old storage contract | Reject or remove it through an explicit development reset; do not migrate |
| A deprecated alias and its replacement are both supplied | The alias must not exist in the current public type or parser |
| A package outside `packages/ConfigForm/` exposes or wraps ConfigForm | Delete that dependency, source, export, auto-loader entry, documentation, and fixture |
| A current protocol has version `1` and matches its literal schema | Accept; the number alone is not evidence of legacy compatibility |

### 5. Good / Base / Bad Cases

- Good: bump a contract, update every producer and consumer atomically, remove
  the prior parser/type/tests, and make stale development state fail closed.
- Base: keep Flow v1 because it is the current and only accepted Flow contract.
- Bad: retain `legacyProject`, an optional `onEvent` alias, an IndexedDB v2→v3
  migrator, or a dormant component migration registry "just in case".

### 6. Tests Required

- Boundary tests accept the current literal and reject lower, higher, missing,
  malformed, and ambiguous versions with stable codes and precise paths.
- Architecture tests scan public exports and production source for removed
  legacy/deprecated symbols, migration entry points, aliases, and fallback
  branches.
- Architecture tests scan repository package manifests, generic component
  aggregators, auto-loaders, examples, and documentation so ConfigForm cannot
  regain a second public route outside `packages/ConfigForm/`.
- Storage tests prove stale records are rejected or reset, never rewritten into
  the current schema.
- Registry tests prove exact adapter/version/fingerprint/component-key and
  component-contract matching; no migration-required success branch exists.
- `pnpm test:config-form-packages` and the affected package build/typecheck/E2E
  gates run after every cross-package hard cut.

### 7. Wrong vs Correct

Wrong:

```ts
if (input.version === CURRENT_VERSION)
  return parseCurrent(input)
return migrateLegacy(input)
```

Correct:

```ts
if (input.version !== CURRENT_VERSION)
  return unsupportedVersion(input.version)
return parseCurrent(input)
```

## 8. ConfigForm Directory Constraints

All ConfigForm packages follow the repository-wide
[directory structure contract](../../directory-structure.md). That document is
the single source of truth for responsibility directories, local barrels,
cross-feature imports, validation cases, and required architecture tests.

ConfigForm adds these current-contract constraints:

- Public Vue contracts live under `types/`; runtime defaults and expose proxy
  logic live in their behavioral directories.
- Package and feature barrels export only current canonical symbols. They do not
  preserve removed paths, aliases, deprecated names, or compatibility wrappers.
- Exact validation between current contracts belongs under `validation/` or
  `schemas/`, never under `compatibility/` or `migrations/`.
- Architecture and type tests reject root-level contract files, obsolete
  forwarding directories, duplicate export names, and removed public paths
  across Runtime, Headless, Designer, adapters, Compiler, and Workbench.
