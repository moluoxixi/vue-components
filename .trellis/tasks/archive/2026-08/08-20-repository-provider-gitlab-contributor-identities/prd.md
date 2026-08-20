# GitLab contributor identity extraction

## Goal

Make GitLab contributor metadata come from the GitLab repository API whenever the
installation exposes its contributors endpoint, while retaining a deterministic
commit-scan fallback for older or restricted GitLab installations that return a
not-found or method-not-allowed response.

## Requirements

- Request `GET /projects/:id/repository/contributors` for each GitLab metadata sync.
- Use online contributor records to canonicalize contributor display names where a
  record matches a component commit's author name and email; keep
  component-specific counts derived from component commits.
- Keep exact, reviewed `gitlab:<sha256> -> username` mappings for profile
  enrichment. Never infer a username, profile URL, or avatar from a display name
  or email.
- Fall back to the existing component commit scan only for HTTP 404 or 405 from
  the contributors endpoint. Authentication failures and malformed successful
  responses remain synchronization errors.
- Keep snapshots free of private email addresses, tokens, cookies, and untrusted
  avatar/profile URLs.
- Preserve strict provider isolation and the production `github` selection.

## Acceptance Criteria

- [x] GitLab contributor endpoint is requested and its verified records are used
      without changing the public snapshot schema.
- [x] 404/405 contributor-endpoint fixtures use the deterministic commit-scan
      fallback; 401/403 and malformed responses fail synchronization.
- [x] Explicit username mappings still enrich only exact online accounts and
      unmatched contributors retain stable IDs and initials fallback.
- [x] Focused GitLab tests, metadata validators, lint, typecheck, and the docs
      build pass.
- [x] The retained JiHu fixture is synchronized or independently verified without
      credentials entering tracked files or logs.

## Notes

- This task does not switch production away from GitHub, add deployment pipelines,
  or merge the local provider snapshot into GitLab metadata.
