# ConfigForm Source Frontend Guidelines

## Status

`@moluoxixi/config-form-source` is a reviewed target package. The product
directory and importable entries do not exist yet. This route documents future
ownership only and must not appear as a current install/import example.

## Guidelines Index

| Guide | Description | Status |
| --- | --- | --- |
| [Repository Directory Structure](../../directory-structure.md) | Package roots, subpath entries, component ownership, and architecture gates | Ready |
| [ConfigForm Product Boundaries](../../config-form/frontend/product-boundaries.md) | One-way Source handoff, command ownership, serialization, and event exclusions | Ready |
| [Studio Domain Contracts](../../config-form/frontend/studio-domain-contracts.md) | Source-owned provider resolver/resource reader inputs, SourceFileSet v1, dependencies, diagnostics, and parity | Target contract |
| [Workbench Quality Contracts](../../config-form-workbench/frontend/quality-guidelines.md) | Current exporter and target generator/Viewer ownership cut | Target contract |
| [Architecture Documentation](../../config-form-core/frontend/architecture-documentation.md) | Current/target documentation and package activation gate | Ready |

## Pre-Development Checklist

- Implement only after Surface, Dataset, Material, and Interaction contracts are
  stable; do not move the current Page-only generator as the final API.
- Root and `/generator` must import in Node without DOM, Vue, Monaco, Workbench,
  Designer, or concrete provider UI.
- Source owns separate provider-neutral component-resolver and asynchronous
  embedded-resource-reader inputs. Studio adapts locked provider metadata and
  Repository content at its composition root and injects both; Source derives
  safe output paths and validates bytes.
- `/viewer` owns only the controlled readonly tree/code component;
  `/viewer/style` owns its styles. Monaco loads asynchronously inside Viewer.
- Studio retains dialog, regeneration, clipboard, download, ZIP, notification,
  and persistence commands.
- Remove the old Workbench implementation directly; keep no wrapper, alias,
  deprecated path, or re-export.
- Create the package at `0.0.0` and include a handwritten minor Changeset for
  its first `0.1.0` release; do not publish a placeholder package first.
- Run deterministic generator, Node-import, Viewer type/unit/browser/a11y,
  generated-consumer, architecture, release, and parity gates before marking
  the package current.
