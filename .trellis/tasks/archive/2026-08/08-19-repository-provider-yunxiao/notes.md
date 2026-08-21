# Validation Notes

## 2026-08-21 Live Acceptance

- Retained private fixture: `https://codeup.aliyun.com/64bac376132d10ed34af0a23/vue-components-provider-fixture` (central API, organization `64bac376132d10ed34af0a23`, repository `7356176`, default branch `master`).
- Live PAT validation succeeded for repository, branch, and commits APIs. The token was used only in memory and was not persisted.
- The snapshot was synchronized at HEAD `c936b3cd4b7447daf6a94ac284aff87d07e33f40`; CopyText contains two commits and one aggregated contributor, while other component paths are empty.
- Enabled capabilities are commit history and contributor aggregation. Issues, issue actions, source, edit, line, and contributor profiles remain disabled because no complete canonical route contract was proven.
- Codeup returns the current page in `x-next-page` on a final single-page response; the collector now treats that as terminal and retains repeated-page protection for actual loops.
- Focused provider tests, offline aggregate validation, docs typecheck, and the VitePress production build pass. Commit `25d7d4a` was pushed to `main`; CI run `32435478705`, Pages run `32436520560`, and Release packages run `32436520411` all succeeded.
