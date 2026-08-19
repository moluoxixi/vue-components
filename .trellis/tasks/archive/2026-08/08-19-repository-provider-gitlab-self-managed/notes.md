# Research Notes

## JiHu live API evidence (2026-08-19)

- `GET https://jihulab.com/api/v4/projects/moluoxixi%2Fvue-components-provider-fixture` returned project `363249` with namespace user `moluoxixi` and the updated avatar path.
- Repository commits and `/repository/contributors` expose Git author `wl` and an email but no GitLab account ID, username, avatar, or profile URL.
- `GET /users?username=moluoxixi` returned exactly one account with ID `268527`, username/name `moluoxixi`, the updated avatar URL, and `https://jihulab.com/moluoxixi` profile URL.
- `GET /users?username=wl` and `GET /projects/363249/users?search=wl` returned no account. Anonymous broad user/email searches were forbidden, and project membership endpoints require authentication.
- Therefore automatic `wl -> moluoxixi` inference is not safe. The approved design uses an explicit stable contributor-ID to exact-username mapping, followed by exact API verification.
- Current CopyText contributor ID is `gitlab:c5bd8c158c76d1ee0e04dfc5460fa34092caf55172fe6154706c94ce08ddc31b`.

## Self-managed environment evidence

- The current implementation already accepts explicit GitLab web/API base URLs and nested project paths.
- Docker CLI is installed, but the Docker Desktop Linux engine was unavailable during planning, so a local GitLab CE container could not yet be started.
- This iteration's required baseline is deterministic custom-origin/relative-path/private-project contract coverage plus retained live JiHu validation. A real local CE container remains an additional check when the daemon becomes available.
