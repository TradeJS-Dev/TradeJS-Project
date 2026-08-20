# GitHub environment and secret ownership

This document defines where GitHub Actions configuration belongs after the
repository split. It lists names and destinations only; secret values must
never be copied into Git, logs, issues, or research artifacts.

## Required moves

| Current or legacy location                                           | Name                                                                           | Canonical destination                                  | Action                                                                                                                                                                                                         |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TradeJS`                                                            | `RELEASE_DEPLOY_KEY`                                                           | none                                                   | Delete it. Engine releases derive versions in an ephemeral job workspace, tag the verified source, and never push release-version commits to `stable`; a private checkout key is not part of the architecture. |
| `TradeJS-Project` repository secrets or a legacy project environment | `DEPLOY_REPOSITORY_TOKEN`                                                      | `TradeJS-Project` → protected `production` environment | Move or create a token authorized to send `repository_dispatch` to `TradeJS-Deploy`. Project publication fails before pushing an image when this value is missing.                                             |
| `TradeJS`, `TradeJS-Project`, or another legacy runtime repository   | `SSH_HOST`, `SSH_USER`, `SSH_KEY`                                              | `TradeJS-Deploy` → protected `production` environment  | Move. Only Deploy workflows may connect to the server.                                                                                                                                                         |
| same legacy locations                                                | `GIT_SSH_PRIVATE_KEY`, `AGENT_GITHUB_TOKEN`                                    | `TradeJS-Deploy` → protected `production` environment  | Move. These credentials belong to the server-side research agent.                                                                                                                                              |
| same legacy locations                                                | `NEXTAUTH_SECRET`, `PG_PASSWORD`, `REDISINSIGHT_HTPASSWD`, `COINALYZE_API_KEY` | `TradeJS-Deploy` → protected `production` environment  | Move. Deploy injects them into the immutable Project runtime; `PG_PASSWORD` has no server-file fallback.                                                                                                       |

`DEPLOY_REPOSITORY_TOKEN` is deliberately separate from server credentials. It
belongs to Project because Project initiates the immutable handoff; the target
Deploy repository owns everything needed after that handoff.

## Secrets that stay with package publishers

`NPM_TOKEN` is not a Project or Deploy secret. Keep one scoped release
credential in every repository that publishes npm packages, or use one
organization secret restricted to this exact repository set:

- `TradeJS`;
- `TradeJS-Base`;
- `TradeJS-Strategy-Kit`;
- every public or private `TradeJS-Strategy-*` package repository.

Reusable workflows require the credential before publication because verified
candidate promotion performs npm dist-tag operations after smoke testing. Do
not give `NPM_TOKEN` to `TradeJS-Project`, `TradeJS-Deploy`,
`TradeJS-Workflows`, the docs repository, or the site repository.

`GITHUB_TOKEN` is generated per workflow run by GitHub. Never create, copy, or
move a secret with that name.

## GitHub Actions variables

The current workflows reference no `${{ vars.* }}` values. Non-secret runtime
defaults belong in `TradeJS-Project/deploy/runtime.env`; local research defaults
belong in `TradeJS-Project/.env`; server credentials belong in the Deploy
`production` environment. Do not recreate a cross-repository variable map.

## Migration commands

Run each `gh secret set` command interactively so the value is read securely
from the terminal. Do not put values on the command line.

```bash
gh secret set DEPLOY_REPOSITORY_TOKEN \
  --repo TradeJS-Dev/TradeJS-Project --env production

for name in SSH_HOST SSH_USER SSH_KEY GIT_SSH_PRIVATE_KEY NEXTAUTH_SECRET \
  PG_PASSWORD AGENT_GITHUB_TOKEN REDISINSIGHT_HTPASSWD COINALYZE_API_KEY; do
  gh secret set "$name" --repo TradeJS-Dev/TradeJS-Deploy --env production
done
```

After Project and Deploy validation workflows can read their environment-owned
secrets, remove duplicate repository-wide or legacy-repository copies. Do not
dispatch `publish.yml` until `DEPLOY_REPOSITORY_TOKEN` is present, and do not
dispatch a production Deploy until all nine Deploy secrets are present.

## Audit note

On 2026-08-20 the `TradeJS` repository exposed the legacy
`RELEASE_DEPLOY_KEY`. It was deleted only after `v3.1.13` completed stable
promotion from the new ephemeral-version workflow. The active `Protect stable`
ruleset was verified to contain only the organization-administrator bypass; no
deploy-key bypass remains.

The same name-only audit found:

- `TradeJS-Project` has repository-wide `DEPLOY_REPOSITORY_TOKEN`, but no
  `production` environment. Re-enter that credential in a new protected
  `production` environment, verify the publish workflow can read it, and only
  then delete the repository-wide copy.
- the unused, empty `TradeJS-Project` `npm-production` environment was deleted;
  Project does not publish npm packages.
- `TradeJS-Deploy` has repository-wide `AGENT_GITHUB_TOKEN`,
  `COINALYZE_API_KEY`, `GIT_SSH_PRIVATE_KEY`, `NEXTAUTH_SECRET`, and
  `REDISINSIGHT_HTPASSWD`; its `production` environment exists but has no
  secrets. Re-enter those five values in `production`, add the missing
  `SSH_HOST`, `SSH_USER`, `SSH_KEY`, and `PG_PASSWORD`, verify deployment there,
  and only then delete the five repository-wide copies.

Secret values were not and must not be inspected. GitHub does not expose a
secret value for copying, so each move requires the original credential source
or a rotated replacement.
