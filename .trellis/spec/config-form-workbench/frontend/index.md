# ConfigForm Workbench Frontend Guidelines

## Overview

These guidelines cover the ConfigForm Workbench application and inherit the
repository-wide directory contract.

## Guidelines Index

| Guide | Description | Status |
| --- | --- | --- |
| [Repository Directory Structure](../../directory-structure.md) | Responsibility-based feature folders and public boundaries | Ready |
| [ConfigForm Product Boundaries](../../config-form/frontend/product-boundaries.md) | Current Workbench status, target Studio ownership, Preview/Source, and removed event domain | Ready |
| [Studio Domain Contracts](../../config-form/frontend/studio-domain-contracts.md) | Target assets, Experience session, Dataset, Source resolver, versions, and diagnostics | Target contract |
| [Quality Contracts](./quality-guidelines.md) | Monaco Vue SFC services, JSON value boundaries, dialog focus restoration, and accessibility gates | Ready |

## Pre-Development Checklist

- Read the repository directory contract before adding or moving a Workbench feature.
- Read the ConfigForm product boundary before changing Preview, Source, transport, or Designer composition.
- Read the Studio domain contract before changing assets, persistence, Dataset authoring, Experience, Runtime Host, import/export, or Source composition.
- Read the quality contracts before changing Monaco, reactive JSON cloning, polymorphic editor values, menus/dialogs, themes, or accessibility tests.
- Run the validation commands named by the relevant contract.
