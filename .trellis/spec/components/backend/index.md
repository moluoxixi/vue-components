# Components Backend Guidelines

## Overview

These guidelines route changes in `components`'s backend layer to the repository
contract and the package-specific contracts that contain real project rules.

## Guidelines Index

| Guide | Description | Status |
| --- | --- | --- |
| [Repository Directory Structure](../../directory-structure.md) | Responsibility-based feature folders and public boundaries | Ready |
| [Public Component Entries](../frontend/public-component-entries.md) | Component build entries, auto-loader, and packed boundaries | Ready |

## Pre-Development Checklist

- Read [Repository Directory Structure](../../directory-structure.md) before creating or moving modules.
- Read [Public Component Entries](../frontend/public-component-entries.md) before changing Vite entries, auto-loaders, manifests, or package exports.
- Read each package-specific contract relevant to the files and behavior being changed.
- Run the validation commands required by those contracts.
