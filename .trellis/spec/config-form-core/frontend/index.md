# Config Form Core Frontend Guidelines

## Overview

These guidelines route changes in `config-form-core`'s frontend layer to the repository
contract and the package-specific contracts that contain real project rules.

## Guidelines Index

| Guide | Description | Status |
| --- | --- | --- |
| [Repository Directory Structure](../../directory-structure.md) | Responsibility-based feature folders and public boundaries | Ready |
| [ConfigForm Product Boundaries](../../config-form/frontend/product-boundaries.md) | Runtime-first product, serialization, Designer Lite, and removed event-domain contracts | Ready |
| [Material Registry](./material-registry.md) | Package-specific contract | Ready |
| [Architecture Documentation](./architecture-documentation.md) | Package-specific contract | Ready |
| [Form Layout Settings](./form-layout-settings.md) | Canonical gap, label width, and responsive span contract | Ready |

## Pre-Development Checklist

- Read [Repository Directory Structure](../../directory-structure.md) before creating or moving modules.
- Read [ConfigForm Product Boundaries](../../config-form/frontend/product-boundaries.md) before changing shared contracts or package boundaries.
- Read each package-specific contract relevant to the files and behavior being changed.
- Run the validation commands required by those contracts.
