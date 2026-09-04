# Components Frontend Guidelines

## Overview

These guidelines route changes in `components`'s frontend layer to the repository
contract and the package-specific contracts that contain real project rules.

## Guidelines Index

| Guide | Description | Status |
| --- | --- | --- |
| [Repository Directory Structure](../../directory-structure.md) | Responsibility-based feature folders and public boundaries | Ready |
| [Hook Guidelines](./hook-guidelines.md) | Package-specific contract | Ready |
| [Public Component Entries](./public-component-entries.md) | Feature ownership, install identity, auto-loader, and renderer contracts | Ready |

## Pre-Development Checklist

- Read [Repository Directory Structure](../../directory-structure.md) before creating or moving modules.
- Read [Public Component Entries](./public-component-entries.md) before changing component ownership, exports, install wrappers, or build entries.
- Read each package-specific contract relevant to the files and behavior being changed.
- Run the validation commands required by those contracts.
