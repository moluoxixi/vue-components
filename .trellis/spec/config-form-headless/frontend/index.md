# Config Form Headless Frontend Guidelines

## Overview

These guidelines route changes in `config-form-headless`'s frontend layer to the repository
contract and the package-specific contracts that contain real project rules.

## Guidelines Index

| Guide | Description | Status |
| --- | --- | --- |
| [Repository Directory Structure](../../directory-structure.md) | Responsibility-based feature folders and public boundaries | Ready |
| [ConfigForm Product Boundaries](../../config-form/frontend/product-boundaries.md) | Production Runtime role, Studio separation, and host listener boundaries | Ready |
| [Studio Domain Contracts](../../config-form/frontend/studio-domain-contracts.md) | Target interaction channels and the boundary between Headless and Prototype Runtime | Target contract |
| [ConfigForm Material Registry](../../config-form-core/frontend/material-registry.md) | Package-specific contract | Ready |
| [ConfigForm Architecture Documentation](../../config-form-core/frontend/architecture-documentation.md) | Package-specific contract | Ready |

## Pre-Development Checklist

- Read [Repository Directory Structure](../../directory-structure.md) before creating or moving modules.
- Read [ConfigForm Product Boundaries](../../config-form/frontend/product-boundaries.md) before changing fields, bindings, host APIs, or package dependencies.
- Read [Studio Domain Contracts](../../config-form/frontend/studio-domain-contracts.md) before changing behavior shared with state projection or value transactions; primary UI actions must remain outside Headless.
- Read each package-specific contract relevant to the files and behavior being changed.
- Run the validation commands required by those contracts.
