# GitHub secret ownership

This document defines which repository owns each GitHub Actions credential
after the repository split. It lists names and scopes only; secret values must
never be copied into Git, logs, issues, or research artifacts.

TradeJS currently does not use GitHub Environments. Repository and selected
organization secrets are sufficient because production does not require a
manual approval gate, branch policy, or separate staging credentials.

## Canonical ownership

| Owner              | Secret                                                                         | Scope                                                                               | Purpose                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `TradeJS-Project`  | `DEPLOY_REPOSITORY_TOKEN`                                                      | repository secret                                                                   | Sends the immutable image/SHA handoff to `TradeJS-Deploy`. Publication fails before pushing the image when it is absent.          |
| `TradeJS-Deploy`   | `SSH_HOST`, `SSH_USER`, `SSH_KEY`                                              | organization secrets restricted to Deploy, or Deploy repository secrets             | Connects only Deploy workflows to the production server.                                                                          |
| `TradeJS-Deploy`   | `GIT_SSH_PRIVATE_KEY`, `AGENT_GITHUB_TOKEN`                                    | repository secrets                                                                  | Gives the server-side research agent its explicitly scoped repository access.                                                     |
| `TradeJS-Deploy`   | `NEXTAUTH_SECRET`, `PG_PASSWORD`, `REDISINSIGHT_HTPASSWD`, `COINALYZE_API_KEY` | repository secrets                                                                  | Injects application and infrastructure credentials into the immutable Project runtime. `PG_PASSWORD` has no server-file fallback. |
| package publishers | `NPM_TOKEN`                                                                    | organization secret restricted to publisher repositories, or per-repository secrets | Promotes verified npm packages.                                                                                                   |

`DEPLOY_REPOSITORY_TOKEN` deliberately remains separate from server
credentials. Project initiates the immutable handoff; Deploy owns everything
needed after that handoff.

The package-publisher scope includes `TradeJS`, `TradeJS-Base`,
`TradeJS-Strategy-Kit`, and every public or private
`TradeJS-Strategy-*` package repository. Do not grant `NPM_TOKEN` to
`TradeJS-Project`, `TradeJS-Deploy`, `TradeJS-Workflows`, the docs repository,
or the site repository.

`GITHUB_TOKEN` is generated for every workflow run by GitHub. Never create,
copy, or move a secret with that name.

## No environment migration

Do not duplicate repository or organization secrets into a `production`
environment. Project publication and Deploy workflows read their existing
scopes directly. A GitHub Environment should be introduced only together with
a concrete approval, branch restriction, or staging/production isolation
requirement.

The current workflows reference no `${{ vars.* }}` values. Non-secret runtime
defaults belong in `TradeJS-Project/deploy/runtime.env`; local research
defaults belong in `TradeJS-Project/.env`. Do not recreate a cross-repository
variable map.

## Audit note

The name-only audit on 2026-08-21 confirmed the Project repository secret
`DEPLOY_REPOSITORY_TOKEN` and the Deploy repository secrets
`AGENT_GITHUB_TOKEN`, `COINALYZE_API_KEY`, `GIT_SSH_PRIVATE_KEY`,
`NEXTAUTH_SECRET`, and `REDISINSIGHT_HTPASSWD`. The organization-owned SSH
secrets shown as available to Deploy remain valid at that scope.

The legacy `TradeJS` secret `RELEASE_DEPLOY_KEY` was deleted after stable
release promotion moved to the ephemeral-version workflow. It must not be
recreated.

Secret values were not and must not be inspected.
