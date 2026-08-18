# TradeJS-Project

The personal TradeJS project and production runtime image for `app.tradejs.dev`.
It is the explicit layer between the published TradeJS engine/packages and
`TradeJS-Deploy`.

This repository was created with the real public generator:

```bash
npx create-tradejs@latest TradeJS-Project --no-install
```

The generated project was then extended with production ownership; it was not
recreated as a monorepo clone.

## Ownership

- `tradejs.config.ts` — installed presets and private/public strategy packages.
- `package.json` and `yarn.lock` — exact TradeJS package composition.
- `deploy/runtime.env` — secret-free production application settings.
- `docker-compose.dev.yml` — local Timescale, Redis, optional pgAdmin, and
  published `ml-infer` orchestration.
- ignored `data/`, `notes/`, and `output/` — local backtest/AI/research
  artifacts, runtime-feedback artifacts, and the durable research record.
- `Dockerfile`, `entrypoint.sh`, and `cronjob` — runtime app image and process
  supervision.
- `.github/workflows/publish.yml` — image publication and immutable dispatch to
  `TradeJS-Deploy`.

`TradeJS` owns the framework packages, strategy-neutral research tooling, and
ML inference image implementation. `TradeJS-Deploy` owns production Compose,
SSH, TLS, server volumes, and server lifecycle. This repository owns local
Compose plus ignored `data/`, `notes/`, and `output/`; these local artifact
directories do not belong in the engine repository or Git.

Production strategy configuration is not stored in this repository or in a
mutable Redis config key. Redis contains immutable per-strategy releases, and a
deployment references exactly `{ strategyName, releaseVersion, controlState }`.
The release owns interval, universe, policy, risk, and exact package versions;
the deployment owns connector and trading-account binding. The app renders the
release config read-only and only exposes pause/resume for new entries.

`deploy/runtime.env` contains only secret-free application defaults. Deploy
injects `PG_PASSWORD`, authentication secrets, exchange/API credentials, and
other production-only secrets when it writes the container environment file.

## Local setup

```bash
cp .env.example .env
yarn install --immutable
yarn infra-up
yarn dev
```

Open <http://localhost:3000/routes/dashboard>. The checked-in `.env.example`
contains names and safe local defaults only; replace all secret placeholders in
the ignored `.env`.

`yarn infra-up` starts Timescale, Redis, and `ml-infer`. The inference service
uses `ghcr.io/tradejs-dev/tradejs-ml-infer:latest` by default, so it no longer
needs a TradeJS checkout, `Dockerfile.infer`, or monorepo source mounts. Override
`ML_INFER_IMAGE` when testing another published tag. The current published
image is `linux/amd64`; `ML_INFER_PLATFORM` makes that explicit and Docker
Desktop runs it under emulation on arm64 hosts. Optional pgAdmin is managed with
`yarn pgadmin:up` and `yarn pgadmin:down`.

The named volumes default to `investing_pgdata`, `investing_redisdata`, and
`investing_pgadmin_data` and are explicitly external so Compose attaches the
existing local databases without relabelling or deleting them. Create these
volumes first on a new machine. Do not use `docker compose down -v` unless you
explicitly intend to delete those databases.

## Backtest and research

Run personal operational flows from this repository:

```bash
yarn backtest
yarn replay
yarn results
yarn ai-export
yarn ai-train --localOnly
yarn ai-pocket-search
yarn research:auto
yarn research:core --help
yarn strategy-release --help
yarn notes:check
```

The project directory is the `PROJECT_CWD`: `.env`, `tradejs.config.ts`,
`data/`, `notes/`, `output/`, and all relative research artifacts resolve here.
When testing unreleased engine changes, point
`TRADEJS_SOURCE_REPOSITORY_ROOT` at the separate TradeJS checkout; Git
SHA/diff/remote and source builds resolve there without moving artifacts out of
this project.

Research notes are permanently ignored and use
`notes/<Strategy>/YYYY-MM-DD-<short-kebab-slug>.md`. Shared records use
`notes/Shared/`, cross-strategy records use `notes/CrossStrategy/`, and files
are not allowed directly under `notes/`. A `reproduction: complete` record must
contain the complete ordered research contract and a machine-readable JSON
metrics snapshot; `yarn notes:check` enforces these invariants.

## Verification

```bash
yarn checks
docker compose -f docker-compose.dev.yml config --quiet
docker build --check .
```

## Production handoff

A successful push to `main` publishes
`ghcr.io/tradejs-dev/tradejs-project-app:<commit-sha>` and dispatches that exact
SHA to `TradeJS-Deploy`. The project workflow needs only the cross-repository
`DEPLOY_REPOSITORY_TOKEN`; application and server secrets remain in Deploy. A
first push still verifies and publishes the image when this token is
absent, but reports a notice and does not dispatch a production rollout.

Every `@tradejs/*` dependency uses an exact version. Image construction fails
if an installed version differs from `package.json`; the generated
`runtime-package-manifest.json` records the same exact versions and Project SHA.
After a strategy package release, update `package.json` and `yarn.lock`, pass
`yarn checks`, and push Project before changing the Redis release pointer.

Before enabling dispatch, either make the GHCR package
`tradejs-project-app` public for the current anonymous Compose pull, or keep it
private and configure a read-only `GHCR_PULL_TOKEN` plus registry login in
`TradeJS-Deploy`. Repository visibility does not automatically make its
container package public.

Keywords: ai, claude, codex.
