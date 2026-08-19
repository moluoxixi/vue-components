# JiHu GitLab Acceptance Research

## Verified Public Contract

Date: 2026-08-19

- Web base URL: `https://jihulab.com`
- REST base URL: `https://jihulab.com/api/v4`
- Authentication: GitLab-compatible `PRIVATE-TOKEN`; anonymous reads work for public projects.
- Public protocol fixture: `pushyzheng/vue-components` (project ID `35215`, default branch `main`).
- Project, branch, open-Issue, and path-scoped commit endpoints returned HTTP 200 anonymously.
- The branch endpoint returned HEAD `8a98ab0592cb6559206aed073b3d2ba5dd149644` during research.
- Canonical `/-/tree`, `/-/blob`, and `/-/commit` routes match the reusable GitLab action builder.
- Anonymous new-Issue and edit operations redirect to sign-in, as expected.

## Retained Fixture

- Project: `moluoxixi/vue-components-provider-fixture`
- Project ID: `363249`
- Visibility: public
- Default branch: `main`
- Origin: imported from `https://github.com/moluoxixi/vue-components.git`
- Imported history: 305 commits, seven branches, and 91 tags at acceptance time
- CopyText path history: eight commits returned anonymously for
  `packages/components/src/CopyText`
- Open Issue: `#1`, `[CopyText] Repository provider acceptance fixture`
- Issue API detail URL: `/-/work_items/1`; JiHu still exposes legacy
  `/-/issues/1`, but REST v4 identifies the work-item route as `web_url`.

The fixture is intentionally retained. Issue #1 remains open so live metadata
sync verifies issue counts and canonical Issue links. The project preserves
real repository history, so no synthetic CopyText commits were necessary.

The accepted snapshot was synchronized anonymously at
`2026-08-19T10:53:43.414Z`. It records default-branch HEAD
`af9833f29c2afc03834714788b985f017944c640`, eight CopyText commits, one
contributor, and one open Issue. Anonymous project, branch, path-scoped commit,
tree, blob, commit-detail, and Issue-detail requests returned HTTP 200.

An authenticated browser session created Issue #1 through the canonical
new-Issue action and reached the project edit action. A later automated edit
route recheck encountered JiHu's browser-security interstitial; it was not
bypassed and is not required by offline CI.

JiHu's REST v4 Issue object remains available from `/projects/:id/issues`, but
its browser `web_url` uses GitLab's newer `/-/work_items/:iid` route. Snapshot
validation therefore accepts both GitLab detail-route families only when the
origin, full project path, and IID exactly match; it does not rewrite the
server-provided URL.
