# Hooks Frontend Guidelines

## Overview

These guidelines route changes in `hooks`'s frontend layer to the repository
contract and the package-specific contracts that contain real project rules.

## Guidelines Index

| Guide | Description | Status |
| --- | --- | --- |
| [Repository Directory Structure](../../directory-structure.md) | Responsibility-based feature folders and public boundaries | Ready |
| [Hooks Quality Contracts](./quality-guidelines.md) | Vue Query state, pagination, mutations, public entry, and publishing | Ready |

## Pre-Development Checklist

- Read [Repository Directory Structure](../../directory-structure.md) before creating or moving modules.
- Read [Hooks Quality Contracts](./quality-guidelines.md) before changing query keys, pagination, mutation order, or package exports.
- Read each package-specific contract relevant to the files and behavior being changed.
- Run the validation commands required by those contracts.
