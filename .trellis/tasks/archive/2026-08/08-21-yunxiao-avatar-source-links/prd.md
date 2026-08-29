# Yunxiao contributor avatars and demo source links

## Goal

Expose the Yunxiao author information and source navigation that Codeup already
provides, so component changelogs show real contributor avatars and demo source
actions open the corresponding Markdown lines in Codeup.

## Background

- The Yunxiao commit response contract includes an optional structured author
  with `avatarUrl` and `username`, but the current collector persists only the
  author name. The theme already renders optional author avatars in both the
  contributor list and commit timeline.
- The authenticated Codeup fixture was verified on 2026-08-21. Its stable web
  routes are `/tree/<branch>/<path>` for directories and
  `/blob/<branch>/<path>` for files. Codeup opens non-README Markdown in a
  preview without line anchors unless the URL contains its `README.md` source
  view marker. With that compatibility marker, direct navigation reliably
  honors a single-line anchor such as `#L3`; range-shaped anchors remain out of
  scope.
- The current Yunxiao provider deliberately disables contributor profiles and
  source links, so any collected avatar fields would currently be stripped and
  demo source actions are not generated.

## Requirements

- Preserve verified Yunxiao author `avatarUrl` and `username` fields in commit
  and aggregated contributor metadata without persisting author email or
  authentication material.
- Display the same collected avatar in both the component contributor list and
  the changelog timeline. Missing or incomplete profile data must continue to
  use the existing name/initial fallback.
- Generate Yunxiao component-directory and demo-source links using the verified
  Codeup tree/blob routes. Markdown demo links must activate Codeup's line-aware
  source view and anchor to the exact start line.
- Encode branch and path segments safely and normalize repository URLs with or
  without a trailing slash.
- Keep issue actions, issue counts, documentation edit links, and contributor
  profile-page links disabled until their routes and API contracts are verified
  independently.
- Update the Chinese and English provider documentation to describe the new
  Yunxiao capability boundary.

## Acceptance Criteria

- [x] A Yunxiao metadata sync fixture containing a structured author produces
      the same avatar and login in the commit author and aggregated contributor.
- [x] Snapshots reject unsupported or malformed author/contributor fields and
      continue to exclude emails and tokens.
- [x] The Yunxiao provider preserves verified avatar/login fields instead of
      stripping them.
- [x] Component source actions resolve to the verified Codeup tree route.
- [x] Demo source actions resolve to the verified Codeup blob route, activate
      the Markdown source view, and use a `#Lx` anchor for the current demo
      block's exact start line.
- [x] The local Yunxiao documentation instance visibly renders the CopyText
      changelog avatar and exposes Codeup component/demo source links.
- [x] Focused provider, collector, validator, theme, type-check, and docs build
      checks pass.

## Out Of Scope

- Yunxiao Issues or issue creation.
- Online documentation editing.
- Inventing a Codeup contributor profile URL when the API does not return a
  verified one.
- Replacing existing playground providers or changing their order.

## Notes

- This is a lightweight extension of the existing repository-provider
  architecture, so the task remains PRD-only.
