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

- `tradejs.config.ts` — small installed-plugin and runtime composition entrypoint.
- `config/runtime/` — modular Git-owned deployments, strategy bindings, and
  frozen ticker selections.
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

Production strategy configuration lives only in the committed
`runtime.deployments` declaration rooted in `tradejs.config.ts` and assembled
from `config/runtime/`. Each strategy owns a complete
`{ generation?, enabled, selection?, config }` binding. `generation` is an
optional human label, not an identity field. Runtime parses the config with the
strategy package and computes `strategyRevision` from exact runtime package
versions plus the complete effective config. It computes a separate
`deploymentCompositionId` from the target and sorted strategy bindings. Exact
npm versions remain in `package.json`, `yarn.lock`, and the image package
manifest. A deployment owns its connector, account id,
asset-class defaults, and strategy bindings. A strategy-owned `selection`
narrows its ticker universe before core evaluation. Forward-test exposure is
controlled by the strategy's `MAX_LOSS_VALUE`, not encoded in module names.

Redis does not contain deployment documents, strategy config, releases, or
result overlays. It retains the server-owned trading account, signals/trades,
heartbeat, audit events, and the optional `users:<user>:runtime:controls`
document. Missing controls mean no manual overrides; pause creates an
`entriesPaused: true` override and resume removes it. The app renders committed
config read-only and exposes only pause/resume for new entries. It does not
require or display a production evidence artifact.

`deploy/runtime.env` selects the `production` declaration consumed by the
signals daemon; the container refuses to start when it is absent. The daemon
re-reads the declaration and controls on every cycle, so pause/resume takes
effect without a restart. Config/package changes arrive through a new immutable
Project image and rebuild the affected session from closed-candle warmup.

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
yarn runtime:manifest
yarn runtime:validate
```

The project directory is the `PROJECT_CWD`: `.env`, `tradejs.config.ts`,
`data/`, `notes/`, `output/`, and all relative research artifacts resolve here.
For source-aware research, set `TRADEJS_SOURCE_REPOSITORY_ROOT` explicitly to
the exact engine or standalone strategy repository under study. Git
SHA/diff/remote and unreleased source builds resolve there without moving
artifacts out of this project; tooling never infers the source repository from
`PROJECT_CWD`.

```bash
TRADEJS_SOURCE_REPOSITORY_ROOT=../tradejs-strategy-trend-line \
  yarn research:auto
```

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

The committed Project composition is stable-only. Framework and package
repositories validate their own prerelease tarballs in isolated npm consumers;
Project assembles only stable exact versions. Validation and image construction
reject prerelease dependencies unconditionally, so a beta package cannot enter
the Project handoff.

Every Monday at `06:00 UTC`, after package promotion windows, the protected
`package-update.yml` workflow resolves the stable npm `latest` tag for every
direct `@tradejs/*` dependency, updates the exact package versions and lockfile
in one batch, runs `yarn checks`, commits one composition, and publishes one
Project image. A manual dispatch provides the same batched emergency sync.
`scripts/project-image-smoke.sh` validates the stable candidate image with
isolated Redis and Timescale, the exact Git-owned declaration, package manifest,
optional pause lifecycle, absence of legacy runtime keys, and application
health. It deliberately does not start the exchange-facing signals daemon or
market websocket; package publication already proves distributable imports,
while live process behavior belongs to explicit runtime validation.

Pushing `main` only updates source. Publishing is an explicit
`workflow_dispatch` of `publish.yml`; it verifies the committed composition,
publishes `ghcr.io/tradejs-dev/tradejs-project-app:<commit-sha>`, and dispatches
that exact SHA to `TradeJS-Deploy`. The Project repository secret
`DEPLOY_REPOSITORY_TOKEN` authorizes that handoff; a missing credential fails
the workflow before image publication. The weekly package update invokes the
same workflow after its stable composition passes checks and Docker smoke.

The complete repository-to-repository ownership and migration commands for
GitHub Actions configuration are documented in
[`docs/github-secret-ownership.md`](docs/github-secret-ownership.md).
The workflow needs only the cross-repository `DEPLOY_REPOSITORY_TOKEN`;
application and server secrets remain in Deploy. Without that token the
workflow fails before publishing an image or dispatching a production rollout.

Every `@tradejs/*` dependency uses an exact version. Image construction fails
if an installed version differs from `package.json`; the generated
`runtime-package-manifest.json` records the same exact versions, including the
strategy packages' TradeJS runtime dependencies, and Project SHA. `yarn checks`
typechecks the declaration, validates the complete plugin catalog, materializes
strategy defaults, rejects stale package inventory, and prints the computed
revisions before building. There is no manual version map or Redis release
pointer. Operators may apply an optional pause override before or after
deployment; Git-disabled strategies cannot be resumed from the UI.

The manifest requires the exact 40-character Project Git SHA. It walks every
installed TradeJS dependency and peer edge, rejects Base/Kit/strategy packages
that bundle a second TradeJS runtime, and fails when the exact host version does
not satisfy a package's peer range.

Before enabling dispatch, either make the GHCR package
`tradejs-project-app` public for the current anonymous Compose pull, or keep it
private and configure a read-only `GHCR_PULL_TOKEN` plus registry login in
`TradeJS-Deploy`. Repository visibility does not automatically make its
container package public.

Keywords: ai, claude, codex.
