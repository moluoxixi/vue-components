# ConfigForm Source Frontend Guidelines

## Status

`@moluoxixi/config-form-source` is a current public package. It owns the
DOM-free dual-output Generator, `SourceFileSetV1` validation, the controlled
readonly Viewer, and the `/generator`, `/viewer`, and `/viewer/style` entries.

## Guidelines Index

| Guide | Description | Status |
| --- | --- | --- |
| [Repository Directory Structure](../../directory-structure.md) | Package roots, subpath entries, component ownership, and architecture gates | Ready |
| [ConfigForm Product Boundaries](../../config-form/frontend/product-boundaries.md) | One-way Source handoff, command ownership, serialization, and event exclusions | Ready |
| [Studio Domain Contracts](../../config-form/frontend/studio-domain-contracts.md) | Source-owned component resolver, ConfigForm binding resolver, resource reader, SourceFileSet v1, dependencies, diagnostics, and parity | Current contract |
| [Workbench Quality Contracts](../../config-form-workbench/frontend/quality-guidelines.md) | Current Source/Studio ownership cut and integration gates | Current contract |
| [Architecture Documentation](../../config-form-core/frontend/architecture-documentation.md) | Current/target documentation and package activation gate | Ready |

## Pre-Development Checklist

- Root and `/generator` must import in Node without DOM, Vue, Monaco, Workbench,
  Designer, or concrete provider UI.
- Keep `generateVueSource` and `generateConfigFormBindings` as two explicit
  outputs. Raw source directly uses Vue, Vue Router, and resolved provider UI;
  bindings expose ConfigForm configuration without App/router/session/overlay
  infrastructure. Neither output may copy a runtime core. Each API owns its
  preflight and may fail without suppressing a successful result from the other.
- Raw `package.json.dependencies` and application runtime bare-package imports
  are limited to `vue`, `vue-router`, and the selected target UI package. They
  must contain no
  `@moluoxixi/*`, `@config-form/*`, ConfigForm, Zod, RuleSet converter,
  Compiler, or internal Runtime dependency. Build-only `devDependencies` such
  as Vite, TypeScript, and their plugins remain allowed. Field Required and
  RuleSet v2 are emitted as readable project-local validation code.
- Preserve nested scoped defaults and field rendering, but fail closed when a
  compilation requires address-scoped interaction settlement, projection, or
  result assignment that the standalone generated app cannot represent yet.
  Do not weaken this guard by emitting root-level code that could cross row
  boundaries; a future scope-address runtime must land as a separate contract
  change with parity coverage.
- Source owns three separate inputs: provider-neutral
  `SourceComponentResolver`, ConfigForm-only
  `SourceConfigFormBindingResolver`, and asynchronous `SourceResourceReader`.
  Raw accepts only the component resolver and resource reader; ConfigForm
  binding generation additionally accepts the binding resolver. Studio adapts
  locked provider metadata and Repository content at its composition root and
  injects them; Source derives safe output paths and validates bytes. A merged
  resolver or compatibility alias is forbidden.
- `/viewer` owns only the controlled readonly tree/code component;
  `/viewer/style` owns its styles. Monaco loads asynchronously inside Viewer.
- Studio retains dialog, regeneration, clipboard, download, ZIP, notification,
  and persistence commands.
- The old Workbench generator and Viewer are removed. Keep no wrapper, alias,
  deprecated path, or re-export.
- Keep the package at source version `0.0.0` with its handwritten minor
  Changeset for the first `0.1.0` release until release tooling applies it.
- Run deterministic generator, Node-import, Viewer type/unit/browser/a11y,
  independent Raw/Binding failure, architecture, release, and parity gates
  before marking Source changes complete. Generated-consumer gates build real
  Element Plus and Ant Design Vue Raw projects, use no internal soft links, scan
  `package.json.dependencies` plus application runtime bare-package imports,
  allow only legitimate build tooling in `devDependencies`, and execute
  Required/RuleSet v2 validation.
