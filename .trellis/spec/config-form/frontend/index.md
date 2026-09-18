# Config Form Frontend Guidelines

## Overview

These guidelines route changes in `config-form`'s frontend layer to the repository
contract and the package-specific contracts that contain real project rules.

## Guidelines Index

| Guide | Description | Status |
| --- | --- | --- |
| [Repository Directory Structure](../../directory-structure.md) | Responsibility-based feature folders and public boundaries | Ready |
| [ConfigForm Product Boundaries](./product-boundaries.md) | Studio target, current Page-only status, host listeners, serialization, and forbidden event domain | Ready |
| [Studio Domain Contracts](./studio-domain-contracts.md) | Surface, Dataset, Prototype Interaction, Source resolver, versions, diagnostics, and tests | Target contract |
| [Runtime State Boundaries](./runtime-state-boundaries.md) | Renderer, Headless controller, validation queue, stale result, and disposal contracts | Ready |

## Pre-Development Checklist

- Read [Repository Directory Structure](../../directory-structure.md) before creating or moving modules.
- Read [ConfigForm Product Boundaries](./product-boundaries.md) before changing public APIs, serialization, component listeners, or package dependencies.
- Read [Studio Domain Contracts](./studio-domain-contracts.md) before changing Surface, Dataset, interaction, Experience, Preview, Source, import/export, or target contract versions.
- Read [Runtime State Boundaries](./runtime-state-boundaries.md) before changing renderer, controller, validation, Data lifecycle, or component listener ordering.
- Read each package-specific contract relevant to the files and behavior being changed.
- Run the validation commands required by those contracts.
