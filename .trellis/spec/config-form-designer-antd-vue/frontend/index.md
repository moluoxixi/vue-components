# Config Form Designer Antd Vue Frontend Guidelines

## Overview

These guidelines route changes in `config-form-designer-antd-vue`'s frontend layer to the repository
contract and the package-specific contracts that contain real project rules.

## Guidelines Index

| Guide | Description | Status |
| --- | --- | --- |
| [Repository Directory Structure](../../directory-structure.md) | Responsibility-based feature folders and public boundaries | Ready |
| [ConfigForm Product Boundaries](../../config-form/frontend/product-boundaries.md) | Current adapter boundary, target Studio responsibility, materials, and serialization | Ready |
| [Studio Domain Contracts](../../config-form/frontend/studio-domain-contracts.md) | Dataset projection, semantic trigger, visual-property, and resolver boundaries | Current contract |
| [ConfigForm Material Registry](../../config-form-core/frontend/material-registry.md) | Package-specific contract | Ready |
| [ConfigForm Architecture Documentation](../../config-form-core/frontend/architecture-documentation.md) | Package-specific contract | Ready |

## Pre-Development Checklist

- Read [Repository Directory Structure](../../directory-structure.md) before creating or moving modules.
- Read [Studio Domain Contracts](../../config-form/frontend/studio-domain-contracts.md) before changing Dataset materials, semantic triggers, or Studio capabilities; legacy Runtime `optionResolver` remains separate from Dataset bindings.
- Read each package-specific contract relevant to the files and behavior being changed.
- Run the validation commands required by those contracts.
