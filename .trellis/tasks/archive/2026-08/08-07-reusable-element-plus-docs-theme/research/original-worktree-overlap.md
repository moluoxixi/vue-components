# Original worktree overlap

The base worktree contained three pre-existing, unrelated-to-this-worktree edits. They were inspected before migration and must remain semantically preserved in the original worktree:

- `docs/vitepress/.vitepress/theme/components/ComponentDocMeta.vue`: wraps the changelog `ElDialog` in `ClientOnly` so the teleported dialog is not rendered during SSR.
- `docs/vitepress/.vitepress/theme/components/DocContributors.vue`: tracks `isMounted` and passes it to Element Plus tooltip `teleported`, avoiding SSR target access.
- `docs/vitepress/.vitepress/theme/components/TypeCell.vue`: tracks `isMounted` and enables tooltip teleport only after mount, avoiding SSR target access.

The new package migration does not overwrite these files. Any feature relocation must retain the same mount-gating behavior if these components are moved later.
