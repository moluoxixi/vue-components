# ConfigForm Prototype Runtime Frontend Guidelines

## Status

`@moluoxixi/config-form-prototype-runtime` is a reviewed target package. The
product directory and importable entries do not exist yet. This spec route does
not authorize an empty package, placeholder manifest, or release entry.

## Guidelines Index

| Guide | Description | Status |
| --- | --- | --- |
| [Repository Directory Structure](../../directory-structure.md) | Responsibility-based package and public-entry boundaries | Ready |
| [ConfigForm Product Boundaries](../../config-form/frontend/product-boundaries.md) | Studio/Runtime ownership, serialization, and forbidden event domain | Ready |
| [Studio Domain Contracts](../../config-form/frontend/studio-domain-contracts.md) | Session v1, Surface instances, parameters/results, UI actions, diagnostics, and reuse | Target contract |
| [Runtime State Boundaries](../../config-form/frontend/runtime-state-boundaries.md) | Form state versus Prototype session state and Preview/Source parity | Target contract |
| [Architecture Documentation](../../config-form-core/frontend/architecture-documentation.md) | Current/target documentation and package activation gate | Ready |

## Pre-Development Checklist

- Confirm the Surface Foundation task is implementing a real shared session use
  case; do not scaffold this package independently.
- Read the Studio domain and Runtime state contracts before defining commands,
  reducers, instance identity, parameters, results, or overlay behavior.
- Keep root and `/session` DOM-free. Put Vue Surface/overlay hosts under `/vue`
  and styles under `/vue/style`.
- Do not import Studio/Workbench, Designer, Source, Core UI adapters, or HTTP.
- Prove Studio Experience and generated projects consume the same reducer.
- Run Node-import, unit, Vue host, package architecture, generated-consumer, and
  Preview/Source parity gates before documenting the package as current.
