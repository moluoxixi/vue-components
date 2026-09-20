# Config Form Model Frontend Guidelines

## Overview

These guidelines route changes in `config-form-model` to the shared ConfigForm
contracts that own persisted shapes, Registry snapshots, and hard-cut versioning.

## Guidelines Index

| Guide | Description | Status |
| --- | --- | --- |
| [Repository Directory Structure](../../directory-structure.md) | Responsibility-based feature folders and public boundaries | Ready |
| [ConfigForm Product Boundaries](../../config-form/frontend/product-boundaries.md) | Studio target, serialization, current status, and removed event-domain contracts | Ready |
| [Studio Domain Contracts](../../config-form/frontend/studio-domain-contracts.md) | Surface/Dataset assets, references, readers, versions, and diagnostics | Current contract |
| [ConfigForm Architecture Documentation](../../config-form-core/frontend/architecture-documentation.md) | Architecture facts and current-contract-only policy | Ready |

## Pre-Development Checklist

- Read the product boundary before changing PageGraph, ProjectDocument, Registry, operations, or references.
- Read the Studio domain contract before implementing SurfaceGraph, Dataset, transfer, interaction, or target version changes.
- Read the current-contract-only policy before changing a version or parser.
- Run Model tests and typecheck plus ConfigForm architecture tests.
