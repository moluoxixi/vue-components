# Vite Config Backend Guidelines

## Overview

These guidelines route changes in `vite-config`'s backend layer to the repository
contract and the package-specific contracts that contain real project rules.

## Guidelines Index

| Guide | Description | Status |
| --- | --- | --- |
| [Repository Directory Structure](../../directory-structure.md) | Responsibility-based feature folders and public boundaries | Ready |
| [Addon Runtime](./addon-runtime.md) | Consumer-root resolution, feature order, merging, and errors | Ready |

## Pre-Development Checklist

- Read [Repository Directory Structure](../../directory-structure.md) before creating or moving modules.
- Read [Addon Runtime](./addon-runtime.md) before changing dependency detection, dynamic imports, feature registry, or merge behavior.
- Read each package-specific contract relevant to the files and behavior being changed.
- Run the validation commands required by those contracts.
