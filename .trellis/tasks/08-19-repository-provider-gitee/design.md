# Design: Gitee repository provider

## Configuration and Snapshot

Compose the shared theme provider contract with Gitee-specific `webBaseUrl`, `apiBaseUrl`, `owner`, `repository`, and default branch configuration. Use a versioned `gitee-metadata.json` containing exact repository identity, canonical web URL, default branch/HEAD, provider feature state, profiles, and per-component commits/contributors/open Issue counts.

## API and Actions

Use REST v5 repository, branch/commit, contributors/users, and repository Issues endpoints. Fetch open Issues and filter component title prefixes client-side when the API search contract cannot express the exact scope. Follow response pagination links and rate-limit headers without hard-coding anonymous quotas.

Gitee actions use `/tree`, `/edit`, `/commit`, and `/issues` routes. Markdown
demo links use Gitee's `/blame/<branch>/<path>#L<start>` line view because the
normal `/blob` route renders Markdown without line anchors and range-shaped
hashes do not scroll reliably. Credentials remain runtime-only and are redacted
from errors/logs.

## Enterprise Boundary

Base URLs are configurable, but public-cloud REST/web compatibility is not assumed for private Gitee installations. The provider documentation states the supported public-cloud baseline and requires instance validation before enabling an enterprise deployment.

## Real Validation

Create a public test-only project under the authenticated Gitee account, add representative CopyText content, commits, and an Issue, then validate API metadata and anonymous/authenticated web actions. Retain the project for regression checks.

